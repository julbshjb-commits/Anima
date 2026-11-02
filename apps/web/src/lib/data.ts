import "server-only";
import { notFound } from "next/navigation";
import type { JournalRole } from "@anima/core";
import { requireUser } from "@/lib/auth";
import type { Journal, JournalEntry, Profile } from "@/lib/database.types";

/**
 * Lectures de données. Toutes passent par la session de l'utilisateur :
 * c'est la RLS de Postgres qui décide de ce qu'il peut voir.
 */

export type JournalCard = Journal & { role: JournalRole; members: Pick<Profile, "id" | "display_name">[] };

export async function listMyJournals(): Promise<{ intime: JournalCard | null; shared: JournalCard[]; me: Profile | null }> {
  const { supabase, user } = await requireUser();
  const [{ data: memberships, error }, { data: me }] = await Promise.all([
    supabase
      .from("journal_members")
      .select("role, journal:journals!inner(*)")
      .eq("user_id", user.id)
      .is("journal.archived_at", null),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw error;

  const journals = (memberships ?? []).map((m) => ({ ...(m.journal as unknown as Journal), role: m.role as JournalRole }));
  const ids = journals.map((j) => j.id);
  const { data: members } = ids.length
    ? await supabase.from("journal_members").select("journal_id, profile:profiles!inner(id, display_name)").in("journal_id", ids)
    : { data: [] };

  const byJournal = new Map<string, Pick<Profile, "id" | "display_name">[]>();
  for (const m of members ?? []) {
    const list = byJournal.get(m.journal_id) ?? [];
    list.push(m.profile as unknown as Pick<Profile, "id" | "display_name">);
    byJournal.set(m.journal_id, list);
  }
  const cards = journals
    .map((j) => ({ ...j, members: byJournal.get(j.id) ?? [] }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return {
    intime: cards.find((j) => j.kind === "intime" && j.owner_id === user.id) ?? null,
    shared: cards.filter((j) => j.kind !== "intime"),
    me: me ?? null,
  };
}

export async function getJournal(id: string) {
  const { supabase, user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: journal } = await supabase.from("journals").select("*").eq("id", id).maybeSingle();
  if (!journal) notFound(); // pas membre = invisible, la RLS ne renvoie rien
  const { data: members } = await supabase
    .from("journal_members")
    .select("role, profile:profiles!inner(id, display_name)")
    .eq("journal_id", id);
  const list = (members ?? []).map((m) => ({
    role: m.role as JournalRole,
    ...(m.profile as unknown as Pick<Profile, "id" | "display_name">),
  }));
  const myRole = list.find((m) => m.id === user.id)?.role ?? "reader";
  return { supabase, user, journal: journal as Journal, members: list, myRole };
}

export type EntryWithPhotos = JournalEntry & { photos: { id: string; url: string }[] };

/** Entrées d'un mois, avec des liens signés de courte durée pour les photos (bucket privé). */
export async function getMonthEntries(journalId: string, from: string, to: string): Promise<EntryWithPhotos[]> {
  const { supabase } = await requireUser();
  const { data: entries, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("journal_id", journalId)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!entries?.length) return [];

  const { data: atts } = await supabase
    .from("attachments")
    .select("id, entry_id, storage_path")
    .in("entry_id", entries.map((e) => e.id));
  const paths = (atts ?? []).map((a) => a.storage_path);
  const signed = paths.length ? (await supabase.storage.from("attachments").createSignedUrls(paths, 60 * 60)).data ?? [] : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return entries.map((e) => ({
    ...e,
    photos: (atts ?? [])
      .filter((a) => a.entry_id === e.id && urlByPath.get(a.storage_path))
      .map((a) => ({ id: a.id, url: urlByPath.get(a.storage_path)! })),
  }));
}
