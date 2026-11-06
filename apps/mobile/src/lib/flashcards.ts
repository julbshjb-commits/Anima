/**
 * Flashcards sur mobile : mêmes tables et même algorithme que le web
 * (@anima/core). Chaque réponse met à jour la date de la carte et l'historique,
 * donc la révision continue d'un appareil à l'autre.
 */
import {
  DEFAULT_SETTINGS,
  buildQueue,
  dayBounds,
  reviewWrite,
  reviewsByDay,
  streakDays,
  type Card,
  type CardSchedule,
  type Deck,
  type QueueItem,
  type Rating,
} from '@anima/core';

import { requireClient } from './supabase';

export type StudyCard = Pick<Card, 'id' | 'deck_id' | 'kind' | 'front' | 'back'>;
export type StudyItem = QueueItem<{ id: string; variant: number; card: StudyCard; deckTitle: string }>;
export type DeckRow = Deck & { due: number; fresh: number; total: number };

async function loadAll() {
  const supabase = requireClient();
  const [decks, cards, schedules, settings] = await Promise.all([
    supabase.from('decks').select('*').order('title'),
    supabase.from('cards').select('id, deck_id, kind, front, back, status, suspended').limit(20000),
    supabase.from('card_schedules').select('*').limit(40000),
    supabase.from('flashcard_settings').select('*').maybeSingle(),
  ]);
  for (const r of [decks, cards, schedules]) if (r.error) throw r.error;
  return { decks: decks.data ?? [], cards: cards.data ?? [], schedules: (schedules.data ?? []) as CardSchedule[], settings: settings.data ?? DEFAULT_SETTINGS };
}

export async function loadFlashcards(deckId: string | null = null) {
  const supabase = requireClient();
  const now = new Date();
  const { day, start, end } = dayBounds(now);
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const [all, logs] = await Promise.all([loadAll(), supabase.from('card_reviews').select('state_before, reviewed_at').gte('reviewed_at', since).limit(10000)]);
  const reviews = logs.data ?? [];
  const today = reviews.filter((r) => r.reviewed_at >= start);
  const active = new Map(all.cards.filter((c) => c.status === 'active' && !c.suspended).map((c) => [c.id, c]));
  const titles = new Map(all.decks.map((d) => [d.id, d.title]));
  const items: StudyItem[] = [];
  for (const s of all.schedules) {
    const card = active.get(s.card_id);
    if (card) items.push({ id: s.id, variant: s.variant, card, deckTitle: titles.get(card.deck_id) ?? '', schedule: s });
  }
  const opts = {
    now,
    endOfDay: end,
    newLeft: all.settings.new_per_day - today.filter((r) => r.state_before === 'nouvelle').length,
    reviewsLeft: all.settings.reviews_per_day - today.filter((r) => r.state_before === 'revision').length,
  };
  const queue = buildQueue(deckId ? items.filter((i) => i.card.deck_id === deckId) : items, opts);
  const decks: DeckRow[] = all.decks.map((d) => {
    const mine = items.filter((i) => i.card.deck_id === d.id);
    return {
      ...d,
      total: all.cards.filter((c) => c.deck_id === d.id && c.status === 'active').length,
      fresh: mine.filter((i) => i.schedule.state === 'nouvelle').length,
      due: mine.filter((i) => i.schedule.state !== 'nouvelle' && Date.parse(i.schedule.due_at) < Date.parse(end)).length,
    };
  });
  return { queue, decks, doneToday: today.length, goal: all.settings.daily_goal, streak: streakDays(Object.keys(reviewsByDay(reviews)), day) };
}

export async function recordReview(item: StudyItem, rating: Rating, durationMs: number) {
  const supabase = requireClient();
  const w = reviewWrite(item.schedule, item.card.deck_id, rating, { durationMs });
  const [u, l] = await Promise.all([
    supabase.from('card_schedules').update(w.update).eq('id', item.id),
    supabase.from('card_reviews').insert(w.log),
  ]);
  if (u.error || l.error) throw u.error ?? l.error;
  return w.next;
}
