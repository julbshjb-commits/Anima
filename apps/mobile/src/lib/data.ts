/**
 * Lectures et écritures de l'appli mobile. Tout passe par la session de
 * l'utilisateur : c'est la RLS de Postgres qui décide de ce qu'il voit
 * (mêmes requêtes que apps/web/src/lib/data.ts).
 */
import {
  entrySchema,
  entryUpdateSchema,
  isValidInviteCode,
  photoPath,
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

export type EntryWithPhotos = JournalEntry & { photos: { id: string; url: string; path: string }[] };

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
  return withPhotos(entries ?? []);
}

/** Une entrée précise (pour la modifier), ou null si elle n'est pas visible. */
export async function getEntry(journalId: string, entryId: string): Promise<EntryWithPhotos | null> {
  const { data, error } = await requireClient()
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .eq('journal_id', journalId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? ((await withPhotos([data]))[0] ?? null) : null;
}

async function withPhotos(entries: JournalEntry[]): Promise<EntryWithPhotos[]> {
  if (!entries.length) return [];
  const supabase = requireClient();
  const { data: atts } = await supabase.from('attachments').select('id, entry_id, storage_path').in('entry_id', entries.map((e) => e.id));
  const paths = (atts ?? []).map((a) => a.storage_path);
  const signed = paths.length ? ((await supabase.storage.from('attachments').createSignedUrls(paths, 60 * 60)).data ?? []) : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return entries.map((e) => ({
    ...e,
    photos: (atts ?? [])
      .filter((a) => a.entry_id === e.id && urlByPath.get(a.storage_path))
      .map((a) => ({ id: a.id, url: urlByPath.get(a.storage_path)!, path: a.storage_path })),
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
type EntryFields = { journalId: string; entryDate: string; title: string; contentText: string; mood: string | null };

/**
 * Crée l'entrée puis envoie les photos dans le stockage privé.
 * La RLS du bucket vérifie que l'auteur peut écrire dans ce journal.
 * Renvoie le nombre de photos qui n'ont pas pu être envoyées.
 */
export async function createEntry(
  userId: string,
  input: EntryFields,
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

  return { failedPhotos: await uploadPhotos(userId, e.journalId, entry.id, photos, onStep) };
}

/**
 * Modifie une entrée, retire les photos demandées puis envoie les nouvelles.
 * La RLS n'autorise que l'auteur, et seulement s'il peut encore écrire.
 */
export async function updateEntry(
  userId: string,
  input: EntryFields & { entryId: string },
  removePhotoIds: string[],
  photos: Photo[],
  onStep: (step: string) => void,
): Promise<{ failedPhotos: number }> {
  const parsed = entryUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Entrée incomplète.');
  const e = parsed.data;

  onStep('Enregistrement…');
  const { data: entry, error } = await requireClient()
    .from('journal_entries')
    .update({
      entry_date: e.entryDate,
      title: e.title || null,
      content: textToDoc(e.contentText),
      content_text: e.contentText,
      mood: e.mood,
    })
    .eq('id', e.entryId)
    .eq('journal_id', e.journalId)
    .eq('author_id', userId)
    .select('id')
    .maybeSingle();
  if (error || !entry) throw new Error('L’entrée n’a pas pu être modifiée. Réessaie.');

  if (removePhotoIds.length) await removePhotos(userId, e.entryId, removePhotoIds);
  return { failedPhotos: await uploadPhotos(userId, e.journalId, e.entryId, photos, onStep) };
}

/** Supprime vraiment l'entrée et ses photos (pas de corbeille). */
export async function deleteEntry(userId: string, entryId: string) {
  // Les fichiers d'abord : une fois la ligne supprimée, on perdrait leur trace.
  await removePhotos(userId, entryId);
  const { error } = await requireClient().from('journal_entries').delete().eq('id', entryId).eq('author_id', userId);
  if (error) throw new Error('L’entrée n’a pas pu être supprimée. Réessaie.');
}

async function removePhotos(userId: string, entryId: string, ids?: string[]) {
  const supabase = requireClient();
  let q = supabase.from('attachments').select('id, storage_path').eq('entry_id', entryId).eq('owner_id', userId);
  if (ids) q = q.in('id', ids);
  const { data: atts } = await q;
  if (!atts?.length) return;
  await supabase.storage.from('attachments').remove(atts.map((a) => a.storage_path));
  await supabase.from('attachments').delete().in('id', atts.map((a) => a.id));
}

/** Envoie les photos dans le stockage privé ; renvoie le nombre d'échecs. */
async function uploadPhotos(userId: string, journalId: string, entryId: string, photos: Photo[], onStep: (step: string) => void) {
  const supabase = requireClient();
  let failed = 0;
  for (const [i, p] of photos.entries()) {
    onStep(`Envoi de la photo ${i + 1} sur ${photos.length}…`);
    const path = photoPath(journalId, entryId, randomUUID(), p.mimeType);
    try {
      const body = await (await fetch(p.uri)).arrayBuffer();
      const up = await supabase.storage.from('attachments').upload(path, body, { contentType: p.mimeType });
      if (up.error) throw up.error;
      const { error: attErr } = await supabase.from('attachments').insert({
        owner_id: userId,
        journal_id: journalId,
        entry_id: entryId,
        storage_path: path,
        mime_type: p.mimeType,
        size_bytes: body.byteLength,
      });
      if (attErr) {
        await supabase.storage.from('attachments').remove([path]);
        throw attErr;
      }
    } catch {
      failed++;
    }
  }
  return failed;
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
