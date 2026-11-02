/**
 * Lectures et écritures de l'appli mobile. Tout passe par la session de
 * l'utilisateur : c'est la RLS de Postgres qui décide de ce qu'il voit
 * (mêmes requêtes que apps/web/src/lib/data.ts).
 */
import {
  entrySchema,
  isValidInviteCode,
  normalizeInviteCode,
  textToDoc,
  type Journal,
  type JournalEntry,
  type JournalRole,
  type Profile,
} from '@anima/core';
import { randomUUID } from 'expo-crypto';

import { requireClient } from './supabase';

type Member = Pick<Profile, 'id' | 'display_name'>;
export type JournalCard = Journal & { role: JournalRole; members: Member[] };

export async function listMyJournals(userId: string) {
  const supabase = requireClient();
  const [{ data: memberships, error }, { data: me }] = await Promise.all([
    supabase.from('journal_members').select('role, journal:journals!inner(*)').eq('user_id', userId).is('journal.archived_at', null),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);
  if (error) throw error;

  const journals = (memberships ?? []).map((m) => ({ ...(m.journal as unknown as Journal), role: m.role as JournalRole }));
  const ids = journals.map((j) => j.id);
  const { data: members } = ids.length
    ? await supabase.from('journal_members').select('journal_id, profile:profiles!inner(id, display_name)').in('journal_id', ids)
    : { data: [] };

  const byJournal = new Map<string, Member[]>();
  for (const m of members ?? []) {
    byJournal.set(m.journal_id, [...(byJournal.get(m.journal_id) ?? []), m.profile as unknown as Member]);
  }
  const cards: JournalCard[] = journals
    .map((j) => ({ ...j, members: byJournal.get(j.id) ?? [] }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return {
    intime: cards.find((j) => j.kind === 'intime' && j.owner_id === userId) ?? null,
    shared: cards.filter((j) => j.kind !== 'intime'),
    me: (me as Profile | null) ?? null,
  };
}

/** Journal + membres, ou null si l'utilisateur n'en est pas membre (la RLS ne renvoie rien). */
export async function getJournal(id: string, userId: string) {
  const supabase = requireClient();
  const { data: journal, error } = await supabase.from('journals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!journal) return null;
  const { data: members } = await supabase
    .from('journal_members')
    .select('role, profile:profiles!inner(id, display_name)')
    .eq('journal_id', id);
  const list = (members ?? []).map((m) => ({ role: m.role as JournalRole, ...(m.profile as unknown as Member) }));
  const myRole = list.find((m) => m.id === userId)?.role ?? 'reader';
  return { journal: journal as Journal, members: list, myRole };
}

export type EntryWithPhotos = JournalEntry & { photos: { id: string; url: string }[] };

/** Entrées d'un mois, avec des liens signés d'une heure pour les photos (stockage privé). */
export async function getMonthEntries(journalId: string, from: string, to: string): Promise<EntryWithPhotos[]> {
  const supabase = requireClient();
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('journal_id', journalId)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!entries?.length) return [];

  const { data: atts } = await supabase.from('attachments').select('id, entry_id, storage_path').in('entry_id', entries.map((e) => e.id));
  const paths = (atts ?? []).map((a) => a.storage_path);
  const signed = paths.length ? ((await supabase.storage.from('attachments').createSignedUrls(paths, 60 * 60)).data ?? []) : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return entries.map((e) => ({
    ...e,
    photos: (atts ?? [])
      .filter((a) => a.entry_id === e.id && urlByPath.get(a.storage_path))
      .map((a) => ({ id: a.id, url: urlByPath.get(a.storage_path)! })),
  }));
}

export async function createIntimeJournal(userId: string): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('journals')
    .insert({ owner_id: userId, title: 'Mon journal intime', kind: 'intime', cover: 'nuit-encre' })
    .select('id')
    .single();
  if (!error) return data.id;
  // Déjà créé (depuis le web par exemple) : on retrouve l'existant.
  const { data: existing } = await supabase.from('journals').select('id').eq('owner_id', userId).eq('kind', 'intime').maybeSingle();
  if (existing) return existing.id;
  throw error;
}

export async function createSharedJournal(userId: string, input: { title: string; kind: Journal['kind']; cover: string }) {
  const supabase = requireClient();
  const { data, error } = await supabase.from('journals').insert({ owner_id: userId, ...input }).select('id').single();
  if (error) throw new Error('Le journal n’a pas pu être créé. Réessaie.');
  return data.id;
}

export type Photo = { uri: string; mimeType: string; size: number };
export const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Crée l'entrée puis envoie les photos dans le stockage privé.
 * La RLS du bucket vérifie que l'auteur peut écrire dans ce journal.
 * Renvoie le nombre de photos qui n'ont pas pu être envoyées.
 */
export async function createEntry(
  userId: string,
  input: { journalId: string; entryDate: string; title: string; contentText: string; mood: string | null },
  photos: Photo[],
  onStep: (step: string) => void,
): Promise<{ failedPhotos: number }> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Entrée incomplète.');
  const e = parsed.data;
  const supabase = requireClient();

  onStep('Enregistrement…');
  const { data: entry, error } = await supabase
    .from('journal_entries')
    .insert({
      journal_id: e.journalId,
      author_id: userId,
      entry_date: e.entryDate,
      title: e.title || null,
      content: textToDoc(e.contentText),
      content_text: e.contentText,
      mood: e.mood,
    })
    .select('id')
    .single();
  if (error || !entry) throw new Error('L’entrée n’a pas pu être enregistrée. Réessaie.');

  let failedPhotos = 0;
  for (const [i, p] of photos.entries()) {
    onStep(`Envoi de la photo ${i + 1} sur ${photos.length}…`);
    const path = `${e.journalId}/${entry.id}/${randomUUID()}.${PHOTO_TYPES[p.mimeType] ?? 'jpg'}`;
    try {
      const body = await (await fetch(p.uri)).arrayBuffer();
      const up = await supabase.storage.from('attachments').upload(path, body, { contentType: p.mimeType });
      if (up.error) throw up.error;
      const { error: attErr } = await supabase.from('attachments').insert({
        owner_id: userId,
        journal_id: e.journalId,
        entry_id: entry.id,
        storage_path: path,
        mime_type: p.mimeType,
        size_bytes: body.byteLength,
      });
      if (attErr) {
        await supabase.storage.from('attachments').remove([path]);
        throw attErr;
      }
    } catch {
      failedPhotos++;
    }
  }
  return { failedPhotos };
}

/** Code d'invitation (haché en base, montré une seule fois en clair). */
export async function createInvite(journalId: string) {
  const { data, error } = await requireClient().rpc('create_journal_invite', { p_journal_id: journalId });
  const row = data?.[0];
  if (error || !row) throw new Error('Impossible de créer une invitation pour ce journal.');
  return row;
}

export async function joinWithCode(raw: string): Promise<string> {
  if (!isValidInviteCode(raw)) throw new Error('Un code fait 6 caractères, par exemple K7M-Q2P.');
  const { data, error } = await requireClient().rpc('join_journal_with_code', { p_code: normalizeInviteCode(raw) });
  if (error?.code === '54000') throw new Error('Trop d’essais. Réessaie dans une heure.');
  if (error || !data) throw new Error('Ce code n’existe pas, a expiré ou a été désactivé.');
  return data;
}

export async function updateDisplayName(userId: string, name: string) {
  const clean = name.trim();
  if (!clean || clean.length > 60) throw new Error('Ton prénom doit faire entre 1 et 60 caractères.');
  const { error } = await requireClient().from('profiles').update({ display_name: clean }).eq('id', userId);
  if (error) throw new Error('Le prénom n’a pas pu être enregistré.');
}
