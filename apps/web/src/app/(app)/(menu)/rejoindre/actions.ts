"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidInviteCode, normalizeInviteCode } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type JoinState = { error?: string };

export async function joinWithCode(_prev: JoinState, form: FormData): Promise<JoinState> {
  const raw = String(form.get("code") ?? "");
  if (!isValidInviteCode(raw)) return { error: "Un code fait 6 caractères, par exemple K7M-Q2P." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("join_journal_with_code", { p_code: normalizeInviteCode(raw) });
  if (error?.code === "54000") return { error: "Trop d'essais. Réessaie dans une heure." };
  if (error || !data) return { error: "Ce code n'existe pas, a expiré ou a été désactivé." };
  revalidatePath("/journaux");
  redirect(`/journaux/${data}`);
}
