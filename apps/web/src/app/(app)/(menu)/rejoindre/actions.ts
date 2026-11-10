"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidDeckCode, isValidInviteCode, normalizeInviteCode } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type JoinState = { error?: string };

export async function joinWithCode(_prev: JoinState, form: FormData): Promise<JoinState> {
  const raw = String(form.get("code") ?? "");
  // 8 caractères : un paquet de flashcards partagé, qu'on regarde avant de l'ajouter.
  if (isValidDeckCode(raw)) redirect(`/flashcards/ajouter?code=${normalizeInviteCode(raw)}`);
  if (!isValidInviteCode(raw)) return { error: "Un code fait 6 caractères (K7M-Q2P), ou 8 pour un paquet de flashcards (K7MQ-2PXA)." };
  const { supabase } = await requireUser();
  // Un même code peut ouvrir un journal partagé, un carnet de cours ou un cercle.
  const { data, error } = await supabase.rpc("join_with_code", { p_code: normalizeInviteCode(raw) });
  if (error?.code === "54000") return { error: "Trop d'essais. Réessaie dans une heure." };
  if (error || !data) return { error: "Ce code n'existe pas, a expiré ou a été désactivé." };
  if (data.type === "cercle") {
    revalidatePath("/cercles");
    redirect(`/cercles?cercle=${data.id}`);
  }
  if (data.type === "carnet") {
    revalidatePath("/notes");
    redirect(`/notes/cours/${data.id}`);
  }
  revalidatePath("/journaux");
  redirect(`/journaux/${data.id}`);
}
