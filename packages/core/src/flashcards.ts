/**
 * Domaine « Flashcards » partagé entre le web et le mobile : schémas, cartes à
 * trous, algorithme de répétition espacée, file du jour et statistiques.
 *
 * L'algorithme suit la famille SM-2 telle qu'Anki l'applique : des étapes
 * d'apprentissage courtes (1 min, 10 min), puis des intervalles en jours qui
 * grandissent selon la facilité de la carte, qui elle-même s'ajuste à chaque
 * réponse (« À revoir », « Difficile », « Bien », « Facile »).
 */
import { z } from "zod";
import { COVER_IDS } from "./journaux";
import { zonedParts, zonedToIso, APP_TIME_ZONE } from "./dates";

/* ------------------------------------------------------------------ */
/* Types et schémas                                                     */
/* ------------------------------------------------------------------ */

export const CARD_KINDS = {
  basique: { label: "Question et réponse", short: "Q/R", hint: "Une question au recto, la réponse au verso." },
  inversee: { label: "Dans les deux sens", short: "Inversée", hint: "Révisée dans les deux sens : recto → verso, puis verso → recto." },
  trous: { label: "Texte à trous", short: "À trous", hint: "Entoure ce qu'il faut retrouver : {{c1::1789}}. Un trou = une révision." },
} as const;
export type CardKind = keyof typeof CARD_KINDS;

export type CardState = "nouvelle" | "apprentissage" | "revision" | "reapprentissage";
export const CARD_STATES: Record<CardState, string> = {
  nouvelle: "Nouvelle",
  apprentissage: "En apprentissage",
  revision: "En révision",
  reapprentissage: "À réapprendre",
};

export type Rating = 1 | 2 | 3 | 4;
export const RATINGS: { value: Rating; label: string; key: string }[] = [
  { value: 1, label: "À revoir", key: "1" },
  { value: 2, label: "Difficile", key: "2" },
  { value: 3, label: "Bien", key: "3" },
  { value: 4, label: "Facile", key: "4" },
];

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null);
const uuidOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().regex(/^[0-9a-f-]{36}$/i, "Lien invalide.").nullable(),
).default(null);

export const deckSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom au paquet.").max(120, "120 caractères maximum."),
  subject: opt(80),
  description: opt(500),
  cover: z.enum(COVER_IDS).default("lumiere-miel"),
  notebook_id: uuidOrNull,
  project_id: uuidOrNull,
  exam_date: z
    .preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'examen invalide.").nullable())
    .default(null),
});
export type DeckInput = z.infer<typeof deckSchema>;

/** Jours avant l'examen (0 = aujourd'hui, négatif = passé). Dates au format AAAA-MM-JJ. */
export function daysUntil(examDate: string, today: string): number {
  return Math.round((Date.parse(`${examDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/** « aujourd'hui », « demain », « dans 12 jours ». */
export function examLabel(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}

/** L'examen le plus proche à venir parmi les paquets. */
export function nextExam<T extends { exam_date: string | null }>(decks: T[], today: string): (T & { days: number }) | null {
  let best: (T & { days: number }) | null = null;
  for (const d of decks) {
    if (!d.exam_date) continue;
    const days = daysUntil(d.exam_date, today);
    if (days >= 0 && (!best || days < best.days)) best = { ...d, days };
  }
  return best;
}

/** Mots-clés : « dates, révolution » → ["dates", "révolution"]. */
export function parseCardTags(raw: unknown): string[] {
  if (Array.isArray(raw)) raw = raw.join(",");
  if (typeof raw !== "string") return [];
  const out = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().toLowerCase().slice(0, 40))
    .filter(Boolean);
  return [...new Set(out)].slice(0, 20);
}

export const cardSchema = z
  .object({
    kind: z.enum(["basique", "inversee", "trous"]).default("basique"),
    front: z.string().trim().min(1, "Écris la question.").max(2000, "2 000 caractères maximum."),
    back: z.string().trim().max(4000, "4 000 caractères maximum.").default(""),
    tags: z.preprocess(parseCardTags, z.array(z.string())).default([]),
  })
  .refine((c) => c.kind === "trous" || c.back.length > 0, { message: "Écris la réponse.", path: ["back"] })
  .refine((c) => c.kind !== "trous" || clozeNumbers(c.front).length > 0, {
    message: "Ajoute au moins un trou, par exemple {{c1::1789}}.",
    path: ["front"],
  });
export type CardInput = z.infer<typeof cardSchema>;

export const settingsSchema = z.object({
  new_per_day: z.coerce.number().int().min(0, "0 au minimum.").max(999, "999 au maximum."),
  reviews_per_day: z.coerce.number().int().min(1, "1 au minimum.").max(9999, "9 999 au maximum."),
  daily_goal: z.coerce.number().int().min(1, "1 au minimum.").max(9999, "9 999 au maximum."),
});
export const DEFAULT_SETTINGS = { new_per_day: 20, reviews_per_day: 200, daily_goal: 30 } as const;

/* ------------------------------------------------------------------ */
/* Cartes à trous et sens de révision                                   */
/* ------------------------------------------------------------------ */

const CLOZE = /\{\{c(\d{1,2})::(.*?)(?:::(.*?))?\}\}/g;

/** Numéros des trous d'un texte, triés : « {{c2::a}} {{c1::b}} » → [1, 2]. */
export function clozeNumbers(text: string): number[] {
  const set = new Set<number>();
  for (const m of text.matchAll(CLOZE)) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

/** Sens à réviser pour une carte (même règle que le déclencheur SQL). */
export function variantsFor(kind: CardKind, front: string): number[] {
  if (kind === "inversee") return [0, 1];
  if (kind === "trous") {
    const n = clozeNumbers(front);
    return n.length ? n : [1];
  }
  return [0];
}

export type Segment = { text: string; hole?: "cache" | "revele" };

/**
 * Découpe un texte à trous pour l'affichage. Le trou révisé est caché côté
 * question (« […] » ou son indice) et mis en valeur côté réponse ; les autres
 * trous s'affichent en clair.
 */
export function renderCloze(text: string, variant: number, side: "question" | "reponse"): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(CLOZE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    const n = Number(m[1]);
    const answer = m[2] ?? "";
    if (n !== variant) out.push({ text: answer });
    else if (side === "question") out.push({ text: m[3] ? `[${m[3]}]` : "[…]", hole: "cache" });
    else out.push({ text: answer, hole: "revele" });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Texte brut d'un côté de carte (aperçus, listes, recherche). */
export function cardFace(
  card: { kind: CardKind; front: string; back: string },
  variant: number,
  side: "question" | "reponse",
): string {
  if (card.kind === "trous") return renderCloze(card.front, variant, side).map((s) => s.text).join("");
  const reversed = card.kind === "inversee" && variant === 1;
  if (side === "question") return reversed ? card.back : card.front;
  return reversed ? card.front : card.back;
}

/* ------------------------------------------------------------------ */
/* Répétition espacée                                                   */
/* ------------------------------------------------------------------ */

export type Schedule = {
  state: CardState;
  step: number;
  due_at: string;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
};

export const SRS = {
  learningSteps: [1, 10], // minutes
  relearningSteps: [10], // minutes
  graduatingInterval: 1, // jours
  easyInterval: 4, // jours
  startingEase: 2.5,
  minEase: 1.3,
  maxEase: 5,
  hardFactor: 1.2,
  easyBonus: 1.3,
  lapseFactor: 0, // part de l'intervalle gardée après un oubli
  maxInterval: 36500,
} as const;

const MIN = 60_000;
const DAY = 86_400_000;

export const NEW_SCHEDULE: Omit<Schedule, "due_at"> = {
  state: "nouvelle",
  step: 0,
  interval_days: 0,
  ease: SRS.startingEase,
  reps: 0,
  lapses: 0,
  last_reviewed_at: null,
};

const clampEase = (e: number) => Math.min(SRS.maxEase, Math.max(SRS.minEase, Math.round(e * 100) / 100));
const clampInterval = (d: number) => Math.min(SRS.maxInterval, Math.max(1, Math.round(d)));

/** Léger hasard sur les longs intervalles, pour ne pas tout revoir le même jour. */
function fuzz(days: number, rand: () => number): number {
  if (days < 3) return days;
  const spread = days < 7 ? 1 : days < 30 ? Math.max(2, days * 0.15) : Math.max(4, days * 0.05);
  return clampInterval(days + (rand() * 2 - 1) * spread);
}

/**
 * Prochain état d'une carte après une réponse. Pur et déterministe si l'on
 * fournit `rand` (le web et le mobile partagent ce calcul).
 */
export function nextSchedule(s: Schedule, rating: Rating, now: Date = new Date(), rand: () => number = Math.random): Schedule {
  const t = now.getTime();
  const base = { ...s, reps: s.reps + 1, last_reviewed_at: now.toISOString() };
  const inMinutes = (m: number) => new Date(t + m * MIN).toISOString();
  const inDays = (d: number) => new Date(t + d * DAY).toISOString();

  if (s.state === "nouvelle" || s.state === "apprentissage") {
    const steps = SRS.learningSteps;
    const step = s.state === "nouvelle" ? 0 : Math.min(s.step, steps.length - 1);
    if (rating === 1) return { ...base, state: "apprentissage", step: 0, due_at: inMinutes(steps[0]!) };
    if (rating === 2) {
      const delay = step === 0 && steps.length > 1 ? (steps[0]! + steps[1]!) / 2 : steps[step]!;
      return { ...base, state: "apprentissage", step, due_at: inMinutes(delay) };
    }
    if (rating === 3 && step + 1 < steps.length) {
      return { ...base, state: "apprentissage", step: step + 1, due_at: inMinutes(steps[step + 1]!) };
    }
    const days = rating === 4 ? SRS.easyInterval : SRS.graduatingInterval;
    return { ...base, state: "revision", step: 0, interval_days: days, due_at: inDays(days) };
  }

  if (s.state === "reapprentissage") {
    const steps = SRS.relearningSteps;
    const step = Math.min(s.step, steps.length - 1);
    if (rating === 1) return { ...base, step: 0, due_at: inMinutes(steps[0]!) };
    if (rating === 2) return { ...base, step, due_at: inMinutes(steps[step]!) };
    if (rating === 3 && step + 1 < steps.length) return { ...base, step: step + 1, due_at: inMinutes(steps[step + 1]!) };
    const days = clampInterval(rating === 4 ? s.interval_days + 1 : s.interval_days);
    return { ...base, state: "revision", step: 0, interval_days: days, due_at: inDays(days) };
  }

  // En révision : l'intervalle grandit avec la facilité, et avec le retard si on s'en souvenait quand même.
  const ivl = Math.max(1, s.interval_days);
  const dueMs = new Date(s.due_at).getTime();
  const late = Math.max(0, (t - dueMs) / DAY);
  if (rating === 1) {
    return {
      ...base,
      state: "reapprentissage",
      step: 0,
      lapses: s.lapses + 1,
      ease: clampEase(s.ease - 0.2),
      interval_days: clampInterval(ivl * SRS.lapseFactor),
      due_at: inMinutes(SRS.relearningSteps[0]!),
    };
  }
  const hard = clampInterval(Math.max(ivl + 1, (ivl + late / 4) * SRS.hardFactor));
  const good = clampInterval(Math.max(hard + 1, (ivl + late / 2) * s.ease));
  const easy = clampInterval(Math.max(good + 1, (ivl + late) * s.ease * SRS.easyBonus));
  const days = rating === 2 ? hard : rating === 3 ? good : easy;
  const ease = rating === 2 ? s.ease - 0.15 : rating === 4 ? s.ease + 0.15 : s.ease;
  const fuzzed = fuzz(days, rand);
  return { ...base, state: "revision", step: 0, ease: clampEase(ease), interval_days: fuzzed, due_at: inDays(fuzzed) };
}

/** « 1 min », « 10 min », « 3 j », « 2 mois », « 1,5 an ». */
export function formatDelay(ms: number): string {
  const min = Math.round(ms / MIN);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(ms / DAY);
  if (d < 31) return `${d} j`;
  if (d < 365) return `${Math.round(d / 30)} mois`;
  return `${(Math.round((d / 365) * 10) / 10).toString().replace(".", ",")} an${d >= 730 ? "s" : ""}`;
}

/** Délais affichés sous les quatre boutons, sans hasard. */
export function previewDelays(s: Schedule, now: Date = new Date()): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of [1, 2, 3, 4] as Rating[]) {
    const n = nextSchedule(s, r, now, () => 0.5);
    out[r] = formatDelay(new Date(n.due_at).getTime() - now.getTime());
  }
  return out;
}

/** Une carte est « acquise » quand son intervalle atteint trois semaines. */
export const isMature = (s: Pick<Schedule, "state" | "interval_days">) => s.state === "revision" && s.interval_days >= 21;

/* ------------------------------------------------------------------ */
/* Journée, file du jour et statistiques                                */
/* ------------------------------------------------------------------ */

/** Début et fin de la journée en cours (Paris), en instants ISO. */
export function dayBounds(now: Date = new Date(), timeZone = APP_TIME_ZONE): { day: string; start: string; end: string } {
  const day = zonedParts(now.toISOString(), timeZone).day;
  const next = new Date(Date.parse(`${day}T12:00:00Z`) + DAY).toISOString().slice(0, 10);
  return { day, start: zonedToIso(day, "00:00", timeZone), end: zonedToIso(next, "00:00", timeZone) };
}

/** Avance autorisée sur les étapes d'apprentissage pendant une séance. */
export const LEARN_AHEAD_MS = 20 * MIN;

export type QueueItem<T> = T & { schedule: Schedule & { id: string } };

/**
 * File d'une séance : d'abord ce qui est en apprentissage et arrive à échéance,
 * puis les révisions du jour (les plus en retard d'abord), puis les nouvelles
 * cartes dans la limite du jour.
 */
export function buildQueue<T>(
  items: QueueItem<T>[],
  opts: { now?: Date; endOfDay: string; newLeft: number; reviewsLeft: number },
): QueueItem<T>[] {
  const now = (opts.now ?? new Date()).getTime();
  const end = Date.parse(opts.endOfDay);
  const due = (i: QueueItem<T>) => Date.parse(i.schedule.due_at);
  const learning = items
    .filter((i) => (i.schedule.state === "apprentissage" || i.schedule.state === "reapprentissage") && due(i) <= Math.max(end, now + LEARN_AHEAD_MS))
    .sort((a, b) => due(a) - due(b));
  const reviews = items
    .filter((i) => i.schedule.state === "revision" && due(i) < end)
    .sort((a, b) => due(a) - due(b))
    .slice(0, Math.max(0, opts.reviewsLeft));
  const fresh = items
    .filter((i) => i.schedule.state === "nouvelle")
    .sort((a, b) => due(a) - due(b))
    .slice(0, Math.max(0, opts.newLeft));
  return [...learning, ...interleave(reviews, fresh)];
}

/** Mêle les nouvelles cartes aux révisions (une nouvelle toutes les quelques révisions). */
function interleave<A>(reviews: A[], fresh: A[]): A[] {
  if (!fresh.length) return reviews;
  if (!reviews.length) return fresh;
  const every = Math.max(1, Math.round(reviews.length / fresh.length));
  const out: A[] = [];
  let f = 0;
  reviews.forEach((r, i) => {
    out.push(r);
    if ((i + 1) % every === 0 && f < fresh.length) out.push(fresh[f++]!);
  });
  return [...out, ...fresh.slice(f)];
}

/** Série : jours consécutifs avec au moins une révision, jusqu'à aujourd'hui (ou hier). */
export function streakDays(reviewDays: Iterable<string>, today: string): number {
  const set = new Set(reviewDays);
  const prev = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - DAY).toISOString().slice(0, 10);
  let d = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = prev(d);
  }
  return n;
}

export type ReviewLog = { rating: number; state_before: CardState; reviewed_at: string };

/** Taux de rétention : part des cartes en révision dont on s'est souvenu. */
export function retentionRate(logs: ReviewLog[]): number | null {
  const r = logs.filter((l) => l.state_before === "revision");
  if (r.length < 5) return null;
  return Math.round((r.filter((l) => l.rating > 1).length / r.length) * 100);
}

/** Nombre de réponses par jour (Paris) : { "2026-11-06": 42 }. */
export function reviewsByDay(logs: Pick<ReviewLog, "reviewed_at">[], timeZone = APP_TIME_ZONE): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of logs) {
    const d = zonedParts(l.reviewed_at, timeZone).day;
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Cartes tirées d'une note, sans IA                                    */
/* ------------------------------------------------------------------ */

export type DraftCard = { kind: CardKind; front: string; back: string };

/**
 * Repère dans une note les lignes qui ressemblent déjà à des fiches :
 * « Terme : définition », « Terme — définition », « Question ? Réponse »,
 * et les phrases qui contiennent déjà des trous {{c1::…}}.
 * C'est une aide mécanique : rien n'est inventé, tout est relu avant d'être gardé.
 */
export function extractDraftCards(text: string): DraftCard[] {
  const out: DraftCard[] = [];
  const seen = new Set<string>();
  const push = (c: DraftCard) => {
    const key = `${c.front}|${c.back}`.toLowerCase();
    if (seen.has(key) || !c.front || (c.kind !== "trous" && !c.back)) return;
    seen.add(key);
    out.push({ ...c, front: c.front.slice(0, 2000), back: c.back.slice(0, 4000) });
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim();
    if (line.length < 3) continue;
    if (clozeNumbers(line).length) {
      push({ kind: "trous", front: line, back: "" });
      continue;
    }
    const q = line.match(/^(.{3,200}?\?)\s+(.{1,600})$/);
    if (q) {
      push({ kind: "basique", front: q[1]!.trim(), back: q[2]!.trim() });
      continue;
    }
    const d = line.match(/^(.{1,80}?)\s*(?:\s:\s|:\s|\s[—–-]\s|\s=\s)\s*(.{2,600})$/);
    if (d && !/^https?$/i.test(d[1]!.trim()) && d[1]!.split(/\s+/).length <= 8) {
      push({ kind: "basique", front: d[1]!.trim(), back: d[2]!.trim() });
    }
  }
  return out.slice(0, 200);
}

/** Consignes données à l'IA qui propose des cartes (web et connecteur). */
export const AI_CARD_RULES = [
  "Une seule idée importante par carte.",
  "Questions et réponses courtes, claires et précises.",
  "N'utilise que ce que dit le document : n'invente rien, n'ajoute aucune connaissance extérieure.",
  "Garde le sens et le vocabulaire du document.",
  "Pour un texte à trous, entoure la partie à retrouver ainsi : {{c1::réponse}}.",
  "Les cartes seront relues et corrigées par la personne avant d'être gardées.",
] as const;

export const draftCardSchema = z.object({
  kind: z.enum(["basique", "inversee", "trous"]).default("basique"),
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().max(4000).default(""),
});

/**
 * Ce qu'une réponse écrit en base : la nouvelle ligne de révision et l'entrée
 * d'historique. Utilisé tel quel par le web et le mobile.
 */
export function reviewWrite(
  s: Schedule & { id: string },
  deckId: string | null,
  rating: Rating,
  opts: { now?: Date; durationMs?: number | null; rand?: () => number } = {},
) {
  const now = opts.now ?? new Date();
  const next = nextSchedule(s, rating, now, opts.rand);
  return {
    update: {
      state: next.state,
      step: next.step,
      due_at: next.due_at,
      interval_days: next.interval_days,
      ease: next.ease,
      reps: next.reps,
      lapses: next.lapses,
      last_reviewed_at: next.last_reviewed_at,
    },
    log: {
      schedule_id: s.id,
      deck_id: deckId,
      rating,
      state_before: s.state,
      interval_before: s.interval_days,
      interval_after: next.interval_days,
      duration_ms: opts.durationMs == null ? null : Math.max(0, Math.min(3_600_000, Math.round(opts.durationMs))),
      reviewed_at: now.toISOString(),
    },
    next,
  };
}
