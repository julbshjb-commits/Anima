import "server-only";
import {
  DEFAULT_SETTINGS,
  buildQueue,
  dayBounds,
  isMature,
  retentionRate,
  reviewsByDay,
  streakDays,
  type CardState,
  type QueueItem,
} from "@anima/core";
import { requireUser } from "@/lib/auth";
import type { Card, CardSchedule, Deck, FlashcardSettings } from "@/lib/database.types";

/** Lectures de l'espace Flashcards : tout est personnel (RLS). */

type Client = Awaited<ReturnType<typeof requireUser>>["supabase"];

export type DeckStats = { total: number; due: number; fresh: number; toCheck: number; mature: number };
export type StudyCard = Pick<Card, "id" | "deck_id" | "kind" | "front" | "back" | "tags" | "note_id">;
export type StudyItem = QueueItem<{ id: string; variant: number; card: StudyCard; deckTitle: string }>;

export type Overview = {
  decks: (Deck & { stats: DeckStats })[];
  settings: Pick<FlashcardSettings, "new_per_day" | "reviews_per_day" | "daily_goal">;
  today: { day: string; done: number; dueLeft: number; newLeft: number; learning: number };
  streak: number;
  retention: number | null;
  heatmap: { day: string; n: number }[];
  totals: { cards: number; mature: number; toCheck: number; reviews: number };
};

async function loadAll(supabase: Client) {
  const [decks, cards, schedules, settings] = await Promise.all([
    supabase.from("decks").select("*").order("subject", { nullsFirst: false }).order("title").limit(500),
    supabase.from("cards").select("id, deck_id, kind, front, back, tags, note_id, status, suspended").limit(20000),
    supabase.from("card_schedules").select("*").limit(40000),
    supabase.from("flashcard_settings").select("*").maybeSingle(),
  ]);
  for (const r of [decks, cards, schedules]) if (r.error) throw r.error;
  return {
    decks: decks.data ?? [],
    cards: cards.data ?? [],
    schedules: schedules.data ?? [],
    settings: settings.data ?? DEFAULT_SETTINGS,
  };
}

async function todayCounts(supabase: Client, start: string) {
  const { data } = await supabase.from("card_reviews").select("state_before").gte("reviewed_at", start).limit(10000);
  const logs = data ?? [];
  return { done: logs.length, newDone: logs.filter((l) => l.state_before === "nouvelle").length, reviewDone: logs.filter((l) => l.state_before === "revision").length };
}

/** File d'une séance (un paquet, ou tous). */
export async function getStudyQueue(
  deckId: string | null,
): Promise<{ items: StudyItem[]; endOfDay: string; dailyGoal: number; doneToday: number; streak: number }> {
  const { supabase } = await requireUser();
  const now = new Date();
  const { day, start, end } = dayBounds(now);
  const since = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  const [all, counts, logs] = await Promise.all([
    loadAll(supabase),
    todayCounts(supabase, start),
    supabase.from("card_reviews").select("reviewed_at").gte("reviewed_at", since).limit(20000),
  ]);
  // Série de jours si la personne révise aujourd'hui (affichée en fin de séance).
  const streak = streakDays([...Object.keys(reviewsByDay(logs.data ?? [])), day], day);
  const items = studyItems(all, deckId);
  const queue = buildQueue(items, {
    endOfDay: end,
    newLeft: all.settings.new_per_day - counts.newDone,
    reviewsLeft: all.settings.reviews_per_day - counts.reviewDone,
  });
  return { items: queue, endOfDay: end, dailyGoal: all.settings.daily_goal, doneToday: counts.done, streak };
}

function studyItems(all: Awaited<ReturnType<typeof loadAll>>, deckId: string | null): StudyItem[] {
  const cards = new Map(all.cards.filter((c) => c.status === "active" && !c.suspended && (!deckId || c.deck_id === deckId)).map((c) => [c.id, c]));
  const titles = new Map(all.decks.map((d) => [d.id, d.title]));
  const out: StudyItem[] = [];
  for (const s of all.schedules) {
    const card = cards.get(s.card_id);
    if (!card) continue;
    out.push({ id: s.id, variant: s.variant, card, deckTitle: titles.get(card.deck_id) ?? "", schedule: s });
  }
  return out;
}

export async function getOverview(): Promise<Overview> {
  const { supabase } = await requireUser();
  const now = new Date();
  const { day, start, end } = dayBounds(now);
  const since = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  const [all, counts, logs] = await Promise.all([
    loadAll(supabase),
    todayCounts(supabase, start),
    supabase.from("card_reviews").select("rating, state_before, reviewed_at").gte("reviewed_at", since).order("reviewed_at", { ascending: false }).limit(20000),
  ]);
  const reviews = (logs.data ?? []) as { rating: number; state_before: CardState; reviewed_at: string }[];
  const endMs = Date.parse(end);
  const isDue = (s: CardSchedule) =>
    (s.state === "revision" || s.state === "apprentissage" || s.state === "reapprentissage") && Date.parse(s.due_at) < endMs;

  const cardById = new Map(all.cards.map((c) => [c.id, c]));
  const stats = new Map<string, DeckStats>(all.decks.map((d) => [d.id, { total: 0, due: 0, fresh: 0, toCheck: 0, mature: 0 }]));
  for (const c of all.cards) {
    const st = stats.get(c.deck_id);
    if (!st) continue;
    if (c.status === "a-verifier") st.toCheck++;
    else st.total++;
  }
  for (const s of all.schedules) {
    const c = cardById.get(s.card_id);
    const st = c && stats.get(c.deck_id);
    if (!c || !st || c.status !== "active" || c.suspended) continue;
    if (s.state === "nouvelle") st.fresh++;
    else if (isDue(s)) st.due++;
    if (isMature(s)) st.mature++;
  }

  const items = studyItems(all, null);
  const newLeft = Math.max(0, all.settings.new_per_day - counts.newDone);
  const queue = buildQueue(items, { now, endOfDay: end, newLeft, reviewsLeft: all.settings.reviews_per_day - counts.reviewDone });
  const byDay = reviewsByDay(reviews);
  const heatmap: { day: string; n: number }[] = [];
  for (let i = 111; i >= 0; i--) {
    const d = new Date(Date.parse(`${day}T12:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10);
    heatmap.push({ day: d, n: byDay[d] ?? 0 });
  }
  const last30 = reviews.filter((r) => Date.parse(r.reviewed_at) > now.getTime() - 30 * 86_400_000);
  const deckStats = [...stats.values()];
  return {
    decks: all.decks.map((d) => ({ ...d, stats: stats.get(d.id)! })),
    settings: all.settings,
    today: {
      day,
      done: counts.done,
      dueLeft: queue.length,
      newLeft: Math.min(newLeft, items.filter((i) => i.schedule.state === "nouvelle").length),
      learning: queue.filter((i) => i.schedule.state === "apprentissage" || i.schedule.state === "reapprentissage").length,
    },
    streak: streakDays(Object.keys(byDay), day),
    retention: retentionRate(last30),
    heatmap,
    totals: {
      cards: deckStats.reduce((n, s) => n + s.total, 0),
      mature: deckStats.reduce((n, s) => n + s.mature, 0),
      toCheck: deckStats.reduce((n, s) => n + s.toCheck, 0),
      reviews: reviews.length,
    },
  };
}

export type DeckDetail = {
  deck: Deck;
  cards: (Card & { schedules: Pick<CardSchedule, "variant" | "state" | "due_at" | "interval_days" | "lapses">[] })[];
  notebooks: { id: string; title: string }[];
  projects: { id: string; title: string }[];
  notes: Record<string, string>;
  /** Nouvelles cartes de l'auteur à récupérer (copie d'un paquet partagé). */
  updates: number;
};

export async function getDeck(id: string): Promise<DeckDetail | null> {
  const { supabase } = await requireUser();
  const { data: deck } = await supabase.from("decks").select("*").eq("id", id).maybeSingle();
  if (!deck) return null;
  const [cards, notebooks, projects, updates] = await Promise.all([
    supabase.from("cards").select("*").eq("deck_id", id).order("created_at", { ascending: false }).limit(5000),
    supabase.from("notebooks").select("id, title").is("archived_at", null).order("title"),
    supabase.from("projects").select("id, title").is("archived_at", null).order("title"),
    deck.source_deck_id ? supabase.rpc("deck_updates", { p_deck_id: id }) : Promise.resolve({ data: 0 }),
  ]);
  const list = cards.data ?? [];
  const ids = list.map((c) => c.id);
  const schedules = ids.length
    ? ((await supabase.from("card_schedules").select("card_id, variant, state, due_at, interval_days, lapses").in("card_id", ids.slice(0, 1000))).data ?? [])
    : [];
  const noteIds = [...new Set(list.map((c) => c.note_id).filter((x): x is string => !!x))];
  const notes = noteIds.length ? ((await supabase.from("notes").select("id, title").in("id", noteIds.slice(0, 500))).data ?? []) : [];
  return {
    deck,
    cards: list.map((c) => ({ ...c, schedules: schedules.filter((s) => s.card_id === c.id) })),
    notebooks: notebooks.data ?? [],
    projects: projects.data ?? [],
    notes: Object.fromEntries(notes.map((n) => [n.id, n.title])),
    updates: updates.data ?? 0,
  };
}

/** Paquets (pour les listes de choix) et dernières notes lisibles. */
export async function getGenerateSources(noteId: string | null) {
  const { supabase } = await requireUser();
  const [decks, notes, note, files] = await Promise.all([
    supabase.from("decks").select("id, title, subject").order("title"),
    supabase.from("notes").select("id, title, notebook_id, updated_at").order("updated_at", { ascending: false }).limit(60),
    noteId ? supabase.from("notes").select("id, title, body, notebook_id").eq("id", noteId).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("files")
      .select("id, name, mime_type")
      .is("trashed_at", null)
      .or("mime_type.eq.application/pdf,mime_type.like.text/*")
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);
  let text = note.data?.body ?? "";
  if (note.data) {
    // Les notes de cours rangent leurs passages dans des blocs : on les ajoute.
    const { data: blocks } = await supabase.from("note_blocks").select("content, kind").eq("note_id", note.data.id).order("created_at").limit(500);
    if (blocks?.length) text = [text, ...blocks.map((b) => b.content)].filter(Boolean).join("\n");
  }
  return {
    decks: decks.data ?? [],
    notes: notes.data ?? [],
    files: files.data ?? [],
    note: note.data ? { id: note.data.id, title: note.data.title, notebook_id: note.data.notebook_id, text } : null,
  };
}
