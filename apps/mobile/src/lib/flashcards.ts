/**
 * Flashcards sur mobile : mêmes tables et même algorithme que le web
 * (@anima/core). Chaque réponse met à jour la date de la carte et l'historique,
 * donc la révision continue d'un appareil à l'autre.
 */
import {
  DEFAULT_SETTINGS,
  buildQueue,
  cardSchema,
  dayBounds,
  isValidDeckCode,
  normalizeInviteCode,
  reviewWrite,
  reviewsByDay,
  streakDays,
  type Card,
  type CardKind,
  type CardSchedule,
  type Deck,
  type DeckPreview,
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

/** Accueil : les cartes du jour et le prénom pour le bonjour. */
export async function loadHome(userId: string) {
  const [fc, me] = await Promise.all([
    loadFlashcards(),
    requireClient().from('profiles').select('display_name').eq('id', userId).maybeSingle(),
  ]);
  return { ...fc, name: (me.data?.display_name ?? '').split(' ')[0] ?? '' };
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

/* Paquets et cartes : créer, ajouter, partager (mêmes règles que le web) --- */

export type DeckCard = Pick<Card, 'id' | 'kind' | 'front' | 'back' | 'created_at'>;

/** Un paquet, ses dernières cartes, et les nouveautés de l'auteur si c'est une copie. */
export async function loadDeck(id: string) {
  const supabase = requireClient();
  const [all, cards] = await Promise.all([
    loadFlashcards(id),
    supabase.from('cards').select('id, kind, front, back, status, created_at').eq('deck_id', id).order('created_at', { ascending: false }).limit(80),
  ]);
  const deck = all.decks.find((d) => d.id === id);
  if (!deck) return null;
  const updates = deck.source_deck_id ? ((await supabase.rpc('deck_updates', { p_deck_id: id })).data ?? 0) : 0;
  const list = cards.data ?? [];
  return {
    deck,
    due: all.queue.length,
    cards: list.filter((c) => c.status === 'active') as DeckCard[],
    toCheck: list.filter((c) => c.status === 'a-verifier').length,
    updates,
  };
}

export async function createDeck(title: string, subject: string): Promise<string> {
  const t = title.trim();
  if (!t) throw new Error('Donne un nom au paquet.');
  const { data, error } = await requireClient()
    .from('decks')
    .insert({ title: t.slice(0, 120), subject: subject.trim().slice(0, 80) || null })
    .select('id')
    .single();
  if (error || !data) throw new Error('Le paquet n’a pas pu être créé. Réessaie.');
  return data.id;
}

/** Ajoute une carte : elle entre tout de suite en révision. */
export async function addCard(deckId: string, card: { kind: CardKind; front: string; back: string }) {
  const parsed = cardSchema.safeParse({ ...card, tags: '' });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Carte invalide.');
  const { error } = await requireClient().from('cards').insert({ ...parsed.data, deck_id: deckId });
  if (error) throw new Error('La carte n’a pas pu être ajoutée.');
}

export async function deleteCard(id: string) {
  const { error } = await requireClient().from('cards').delete().eq('id', id);
  if (error) throw new Error('La carte n’a pas pu être supprimée.');
}

/** Donne (ou retire) le code de partage. Les progrès ne sont jamais partagés. */
export async function shareDeck(id: string, on: boolean): Promise<string | null> {
  const { data, error } = await requireClient().rpc('deck_share', { p_deck_id: id, p_on: on });
  if (error) throw new Error('Le partage n’a pas pu être modifié.');
  return data;
}

export async function previewDeck(raw: string): Promise<{ code: string; preview: DeckPreview }> {
  if (!isValidDeckCode(raw)) throw new Error('Un code de paquet fait 8 caractères, par exemple K7MQ-2PXA.');
  const code = normalizeInviteCode(raw);
  const { data } = await requireClient().rpc('deck_preview', { p_code: code });
  if (!data) throw new Error('Ce code ne correspond à aucun paquet partagé. Il a peut-être été retiré.');
  return { code, preview: data };
}

/** Ajoute sa copie d'un paquet partagé (ou complète celle qu'on a déjà). */
export async function importDeck(code: string): Promise<string> {
  const { data, error } = await requireClient().rpc('deck_import', { p_code: code });
  if (error || !data) throw new Error('Le paquet n’a pas pu être ajouté. Réessaie.');
  return data;
}

export async function pullDeck(id: string): Promise<number> {
  const { data, error } = await requireClient().rpc('deck_pull', { p_deck_id: id });
  if (error) throw new Error('Les nouvelles cartes n’ont pas pu être récupérées.');
  return data ?? 0;
}
