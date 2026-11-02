"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type InviteState = { code?: string; expiresAt?: string; error?: string };

/** Génère un code (stocké haché côté serveur, montré une seule fois en clair). */
export async function createInvite(_prev: InviteState, form: FormData): Promise<InviteState> {
  const journalId = z.uuid().safeParse(form.get("journalId"));
  if (!journalId.success) return { error: "Journal introuvable." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_journal_invite", { p_journal_id: journalId.data });
  const row = data?.[0];
  if (error || !row) return { error: "Impossible de créer une invitation pour ce journal." };
  revalidatePath(`/journaux/${journalId.data}/inviter`);
  return { code: row.code, expiresAt: row.expires_at };
}

export async function revokeInvite(form: FormData) {
  const id = z.uuid().parse(form.get("inviteId"));
  const journalId = z.uuid().parse(form.get("journalId"));
  const { supabase } = await requireUser();
  await supabase.rpc("revoke_journal_invite", { p_invite_id: id });
  revalidatePath(`/journaux/${journalId}/inviter`);
}
