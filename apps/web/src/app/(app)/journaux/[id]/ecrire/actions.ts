"use server";
import { revalidatePath } from "next/cache";
import { entrySchema, textToDoc } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type CreateEntryResult = { error: string } | { entryId: string };

/**
 * Crée l'entrée. Les photos sont ensuite envoyées directement du navigateur
 * vers le stockage privé (voir EntryForm) : la RLS du bucket vérifie que
 * l'auteur peut écrire dans ce journal.
 */
export async function createEntry(input: {
  journalId: string;
  entryDate: string;
  title: string;
  contentText: string;
  mood: string | null;
}): Promise<CreateEntryResult> {
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
