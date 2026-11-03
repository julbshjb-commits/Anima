"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export type SimpleState = { error?: string; ok?: boolean };

export async function updateName(_prev: SimpleState, form: FormData): Promise<SimpleState> {
  const name = z.string().trim().min(1, "Ton prénom ne peut pas être vide.").max(60).safeParse(form.get("displayName"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ display_name: name.data }).eq("id", user.id);
  if (error) return { error: "Le changement n'a pas été enregistré." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Supprime le compte : transmet d'abord les journaux partagés, efface les
 * photos de l'utilisateur, puis supprime l'utilisateur (cascade en base).
 */
export async function deleteAccount(_prev: SimpleState, form: FormData): Promise<SimpleState> {
  if (form.get("confirm") !== "SUPPRIMER") return { error: "Écris SUPPRIMER pour confirmer." };
  const admin = adminClient();
  if (!admin) return { error: "La suppression n'est pas encore configurée sur ce serveur." };

  const { supabase, user } = await requireUser();
  const { error: prepErr } = await supabase.rpc("prepare_account_deletion");
  if (prepErr) return { error: "La suppression a échoué. Rien n'a été effacé." };

  const { data: files } = await admin.from("attachments").select("storage_path").eq("owner_id", user.id);
  const paths = (files ?? []).map((f: { storage_path: string }) => f.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from("attachments").remove(paths.slice(i, i + 100));
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "La suppression a échoué. Écris-nous si cela se reproduit." };
  await supabase.auth.signOut();
  redirect("/");
}
