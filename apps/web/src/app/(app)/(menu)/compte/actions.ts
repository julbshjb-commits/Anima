"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiSpacesSchema } from "@anima/core";
import { requireUser } from "@/lib/auth";
import { saveAiSpaces } from "@/lib/ia";
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
 * photos et les fichiers de l'utilisateur, puis supprime l'utilisateur (cascade en base).
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

  // Fichiers du disque : tout le dossier {id}/ du bucket « fichiers ».
  for (;;) {
    const { data: objects } = await admin.storage.from("fichiers").list(user.id, { limit: 100 });
    if (!objects?.length) break;
    const { error: rmErr } = await admin.storage.from("fichiers").remove(objects.map((o) => `${user.id}/${o.name}`));
    if (rmErr) return { error: "La suppression a échoué. Écris-nous si cela se reproduit." };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "La suppression a échoué. Écris-nous si cela se reproduit." };
  await supabase.auth.signOut();
  redirect("/");
}

/** Espaces ouverts aux assistants IA, modifiés depuis Réglages. */
export async function saveAiAccess(_prev: SimpleState, form: FormData): Promise<SimpleState> {
  const spaces = aiSpacesSchema.safeParse(form.getAll("spaces"));
  if (!spaces.success) return { error: "Choix d'espaces invalide." };
  const { supabase, user } = await requireUser();
  const { error } = await saveAiSpaces(supabase, user.id, spaces.data);
  if (error) return { error: "Tes choix n'ont pas pu être enregistrés." };
  revalidatePath("/compte");
  return { ok: true };
}

/** Retire l'accès d'une appli : ses jetons ne marchent plus. */
export async function revokeApp(form: FormData) {
  const clientId = String(form.get("clientId") ?? "");
  if (!/^[\w.:/-]{1,300}$/.test(clientId)) return;
  const { supabase } = await requireUser();
  await supabase.auth.oauth.revokeGrant({ clientId });
  revalidatePath("/compte");
}
