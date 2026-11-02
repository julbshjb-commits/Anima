"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createJournalSchema } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type FormState = { error?: string };

/** Crée le journal intime : un seul par personne (index unique en base), jamais partageable. */
export async function createIntimeJournal() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("journals")
    .insert({ owner_id: user.id, title: "Mon journal intime", kind: "intime", cover: "nuit-encre" })
    .select("id")
    .single();
  if (error) {
    // Déjà créé (course entre deux onglets) : on retrouve l'existant.
    const { data: existing } = await supabase
      .from("journals")
      .select("id")
      .eq("owner_id", user.id)
      .eq("kind", "intime")
      .maybeSingle();
    if (existing) redirect(`/journaux/${existing.id}`);
    throw error;
  }
  revalidatePath("/journaux");
  redirect(`/journaux/${data.id}`);
}

export async function createSharedJournal(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = createJournalSchema.safeParse({
    title: form.get("title"),
    kind: form.get("kind"),
    cover: form.get("cover"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("journals")
    .insert({ owner_id: user.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return { error: "Le journal n'a pas pu être créé. Réessaie." };
  revalidatePath("/journaux");
  redirect(`/journaux/${data.id}/inviter`);
}
