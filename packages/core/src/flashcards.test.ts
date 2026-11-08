import { describe, expect, it } from "vitest";
import {
  NEW_SCHEDULE, buildQueue, cardFace, cardSchema, clozeNumbers, dayBounds, daysUntil, deckSchema, examLabel, extractDraftCards, formatDeckCode,
  formatDelay, isValidDeckCode, nextExam, nextSchedule, previewDelays, renderCloze, retentionRate, streakDays, variantsFor, type Schedule,
} from "./index";

const now = new Date("2026-11-06T10:00:00Z");
const fresh: Schedule = { ...NEW_SCHEDULE, due_at: now.toISOString() };
const noFuzz = () => 0.5;
const mins = (s: Schedule, from = now) => Math.round((Date.parse(s.due_at) - from.getTime()) / 60000);

describe("répétition espacée", () => {
  it("fait passer une nouvelle carte par les étapes 1 min puis 10 min", () => {
    const a = nextSchedule(fresh, 3, now, noFuzz);
    expect(a.state).toBe("apprentissage");
    expect(mins(a)).toBe(10);
    const b = nextSchedule(a, 3, now, noFuzz);
    expect(b.state).toBe("revision");
    expect(b.interval_days).toBe(1);
    expect(nextSchedule(fresh, 1, now).state).toBe("apprentissage");
    expect(mins(nextSchedule(fresh, 1, now))).toBe(1);
    expect(mins(nextSchedule(fresh, 2, now))).toBe(6);
  });
  it("« Facile » sur une nouvelle carte la met directement à 4 jours", () => {
    const s = nextSchedule(fresh, 4, now, noFuzz);
    expect(s.state).toBe("revision");
    expect(s.interval_days).toBe(4);
  });
  it("allonge l'intervalle selon la facilité, et la fait baisser sur « Difficile »", () => {
    const r: Schedule = { ...fresh, state: "revision", interval_days: 10, ease: 2.5, due_at: now.toISOString() };
    expect(nextSchedule(r, 3, now, noFuzz).interval_days).toBe(25);
    const hard = nextSchedule(r, 2, now, noFuzz);
    expect(hard.interval_days).toBe(12);
    expect(hard.ease).toBe(2.35);
    const easy = nextSchedule(r, 4, now, noFuzz);
    expect(easy.interval_days).toBeGreaterThan(25);
    expect(easy.ease).toBe(2.65);
  });
  it("un oubli renvoie la carte en réapprentissage et compte un trou de mémoire", () => {
    const r: Schedule = { ...fresh, state: "revision", interval_days: 30, ease: 2.5, due_at: now.toISOString() };
    const lapse = nextSchedule(r, 1, now, noFuzz);
    expect(lapse.state).toBe("reapprentissage");
    expect(lapse.lapses).toBe(1);
    expect(lapse.ease).toBe(2.3);
    expect(mins(lapse)).toBe(10);
    const back = nextSchedule(lapse, 3, now, noFuzz);
    expect(back.state).toBe("revision");
    expect(back.interval_days).toBe(1);
  });
  it("ne descend jamais sous la facilité minimale", () => {
    let s: Schedule = { ...fresh, state: "revision", interval_days: 5, ease: 1.35, due_at: now.toISOString() };
    s = nextSchedule(s, 1, now, noFuzz);
    expect(s.ease).toBe(1.3);
  });
  it("tient compte du retard quand on s'en souvenait quand même", () => {
    const due = new Date(now.getTime() - 10 * 86400000).toISOString();
    const r: Schedule = { ...fresh, state: "revision", interval_days: 10, ease: 2.5, due_at: due };
    expect(nextSchedule(r, 3, now, noFuzz).interval_days).toBe(38);
  });
  it("affiche des délais lisibles sous les boutons", () => {
    expect(previewDelays(fresh, now)).toEqual({ 1: "1 min", 2: "6 min", 3: "10 min", 4: "4 j" });
    expect(formatDelay(45 * 86400000)).toBe("2 mois");
    expect(formatDelay(800 * 86400000)).toBe("2,2 ans");
  });
});

describe("cartes", () => {
  it("lit les trous et les sens", () => {
    expect(clozeNumbers("{{c2::a}} et {{c1::b::indice}} puis {{c2::c}}")).toEqual([1, 2]);
    expect(variantsFor("inversee", "x")).toEqual([0, 1]);
    expect(variantsFor("basique", "x")).toEqual([0]);
  });
  it("cache le bon trou", () => {
    const t = "La {{c1::Bastille}} tombe en {{c2::1789::année}}.";
    expect(cardFace({ kind: "trous", front: t, back: "" }, 1, "question")).toBe("La […] tombe en 1789.");
    expect(cardFace({ kind: "trous", front: t, back: "" }, 2, "question")).toBe("La Bastille tombe en [année].");
    expect(renderCloze(t, 2, "reponse").find((s) => s.hole)).toEqual({ text: "1789", hole: "revele" });
  });
  it("inverse recto et verso", () => {
    const c = { kind: "inversee" as const, front: "Liberté", back: "Freedom" };
    expect(cardFace(c, 1, "question")).toBe("Freedom");
    expect(cardFace(c, 1, "reponse")).toBe("Liberté");
  });
  it("refuse un texte à trous sans trou et une question sans réponse", () => {
    expect(cardSchema.safeParse({ kind: "trous", front: "Rien" }).success).toBe(false);
    expect(cardSchema.safeParse({ kind: "basique", front: "Q ?", back: "" }).success).toBe(false);
    expect(cardSchema.parse({ front: "Q ?", back: "R", tags: "Dates, #révolution" }).tags).toEqual(["dates", "révolution"]);
  });
});

describe("tirer des cartes d'une note", () => {
  it("repère définitions, questions et trous, sans rien inventer", () => {
    const cards = extractDraftCards(
      "Cours du 3 novembre\n- Photosynthèse : production de matière organique grâce à la lumière\nQuelle est la capitale de l'Australie ? Canberra\nLa {{c1::mitochondrie}} produit l'énergie.\nUne phrase normale sans rien.\nhttps://exemple.org",
    );
    expect(cards).toEqual([
      { kind: "basique", front: "Photosynthèse", back: "production de matière organique grâce à la lumière" },
      { kind: "basique", front: "Quelle est la capitale de l'Australie ?", back: "Canberra" },
      { kind: "trous", front: "La {{c1::mitochondrie}} produit l'énergie.", back: "" },
    ]);
  });
});

describe("journée et progrès", () => {
  it("borne la journée à Paris", () => {
    const b = dayBounds(new Date("2026-11-06T23:30:00Z"));
    expect(b.day).toBe("2026-11-07");
    expect(b.start).toBe("2026-11-06T23:00:00.000Z");
    expect(b.end).toBe("2026-11-07T23:00:00.000Z");
  });
  it("compte la série, même si on n'a pas encore révisé aujourd'hui", () => {
    expect(streakDays(["2026-11-04", "2026-11-05", "2026-11-06"], "2026-11-06")).toBe(3);
    expect(streakDays(["2026-11-04", "2026-11-05"], "2026-11-06")).toBe(2);
    expect(streakDays(["2026-11-03"], "2026-11-06")).toBe(0);
  });
  it("calcule la rétention sur les cartes en révision", () => {
    const logs = [1, 3, 3, 4, 3, 2].map((rating) => ({ rating, state_before: "revision" as const, reviewed_at: "" }));
    expect(retentionRate(logs)).toBe(83);
    expect(retentionRate(logs.slice(0, 2))).toBeNull();
  });
  it("construit la file : apprentissage, révisions du jour, puis nouvelles dans la limite", () => {
    const { end } = dayBounds(now);
    const mk = (id: string, state: Schedule["state"], due: string) => ({ id, schedule: { ...fresh, id, state, due_at: due } });
    const items = [
      mk("n1", "nouvelle", "2026-11-01T00:00:00Z"),
      mk("n2", "nouvelle", "2026-11-02T00:00:00Z"),
      mk("r-demain", "revision", "2026-11-08T08:00:00Z"),
      mk("r1", "revision", "2026-11-06T08:00:00Z"),
      mk("l1", "apprentissage", "2026-11-06T10:05:00Z"),
    ];
    const q = buildQueue(items, { now, endOfDay: end, newLeft: 1, reviewsLeft: 100 });
    expect(q.map((i) => i.id)).toEqual(["l1", "r1", "n1"]);
  });
});

describe("paquets partagés et examens", () => {
  it("lit et affiche un code de paquet", () => {
    expect(isValidDeckCode("k7mq-2pxa")).toBe(true);
    expect(isValidDeckCode("K7M-Q2P")).toBe(false);
    expect(isValidDeckCode("K7MQ2PX0")).toBe(false);
    expect(formatDeckCode("k7mq2pxa")).toBe("K7MQ-2PXA");
  });

  it("compte les jours avant l'examen et trouve le plus proche", () => {
    expect(daysUntil("2027-01-18", "2027-01-06")).toBe(12);
    expect(daysUntil("2027-03-28", "2027-03-27")).toBe(1);
    expect(examLabel(0)).toBe("aujourd'hui");
    expect(examLabel(12)).toBe("dans 12 jours");
    const decks = [
      { id: "a", exam_date: "2027-01-02" },
      { id: "b", exam_date: "2027-01-20" },
      { id: "c", exam_date: null },
      { id: "d", exam_date: "2027-01-12" },
    ];
    expect(nextExam(decks, "2027-01-06")).toMatchObject({ id: "d", days: 6 });
    expect(nextExam([{ exam_date: "2026-12-01" }], "2027-01-06")).toBeNull();
  });

  it("accepte une date d'examen vide ou au bon format", () => {
    expect(deckSchema.parse({ title: "Cœur", exam_date: "" }).exam_date).toBeNull();
    expect(deckSchema.parse({ title: "Cœur", exam_date: "2027-01-18" }).exam_date).toBe("2027-01-18");
    expect(deckSchema.safeParse({ title: "Cœur", exam_date: "18/01/2027" }).success).toBe(false);
  });
});
