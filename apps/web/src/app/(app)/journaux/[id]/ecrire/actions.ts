"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { entrySchema, entryUpdateSchema, textToDoc } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type SaveEntryResult = { error: string } | { entryId: string };

type EntryFields = {
  journalId: string;
  entryDate: string;
  title: string;
  contentText: string;
  mood: string | null;
};

/**
 * Crée l'entrée. Les photos sont ensuite envoyées directement du navigateur
 * vers le stockage privé (voir EntryForm) : la RLS du bucket vérifie que
 * l'auteur peut écrire dans ce journal.
 */
export async function createEntry(input: EntryFields): Promise<SaveEntryResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrée incomplète." };

  const { supabase, user } = await requireUser();
  const e = parsed.data;
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .insert({
      journal_id: e.journalId,
      author_id: user.id,
      entry_date: e.entryDate,
      title: e.title || null,
      content: textToDoc(e.contentText),
      content_text: e.contentText,
      mood: e.mood,
    })
    .select("id")
    .single();
  if (error || !entry) return { error: "L'entrée n'a pas pu être enregistrée. Réessaie." };
  revalidatePath(`/journaux/${e.journalId}`);
  return { entryId: entry.id };
}

/**
 * Modifie une entrée et retire les photos demandées. La RLS n'autorise
 * que l'auteur, et seulement s'il peut encore écrire dans le journal.
 */
export async function updateEntry(input: EntryFields & { entryId: string; removePhotoIds: string[] }): Promise<SaveEntryResult> {
  const parsed = entryUpdateSchema.safeParse(input);
  const removeIds = z.array(z.uuid()).max(10).safeParse(input.removePhotoIds);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrée incomplète." };
  if (!removeIds.success) return { error: "Photos à retirer invalides." };

  const { supabase, user } = await requireUser();
  const e = parsed.data;
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .update({
      entry_date: e.entryDate,
      title: e.title || null,
      content: textToDoc(e.contentText),
      content_text: e.contentText,
      mood: e.mood,
    })
    .eq("id", e.entryId)
    .eq("journal_id", e.journalId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !entry) return { error: "L'entrée n'a pas pu être modifiée. Réessaie." };

  if (removeIds.data.length) await removePhotos(supabase, user.id, e.entryId, removeIds.data);
  revalidatePath(`/journaux/${e.journalId}`);
  return { entryId: entry.id };
}

/** Supprime vraiment l'entrée et ses photos (pas de corbeille). */
export async function deleteEntry(form: FormData) {
  const journalId = z.uuid().parse(form.get("journalId"));
  const entryId = z.uuid().parse(form.get("entryId"));
  const { supabase, user } = await requireUser();

  // Les fichiers d'abord : une fois la ligne supprimée, on perdrait leur trace.
  await removePhotos(supabase, user.id, entryId);
  await supabase.from("journal_entries").delete().eq("id", entryId).eq("author_id", user.id);
  revalidatePath(`/journaux/${journalId}`);
  redirect(`/journaux/${journalId}`);
}

type Client = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function removePhotos(supabase: Client, userId: string, entryId: string, ids?: string[]) {
  let q = supabase.from("attachments").select("id, storage_path").eq("entry_id", entryId).eq("owner_id", userId);
  if (ids) q = q.in("id", ids);
  const { data: atts } = await q;
  if (!atts?.length) return;
  await supabase.storage.from("attachments").remove(atts.map((a) => a.storage_path));
  await supabase.from("attachments").delete().in("id", atts.map((a) => a.id));
}
