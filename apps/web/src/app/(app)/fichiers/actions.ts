"use server";
import { revalidatePath } from "next/cache";
import { fileNameSchema, folderNameSchema } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type FichierState = { error?: string; ok?: number };

const uuid = (v: FormDataEntryValue | null | undefined) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const ok = (): FichierState => {
  revalidatePath("/fichiers");
  return { ok: Date.now() };
};

export async function createFolder(_: FichierState, form: FormData): Promise<FichierState> {
  const name = folderNameSchema.safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("folders").insert({ name: name.data, parent_id: uuid(form.get("parentId")) });
  if (error) return { error: "Le dossier n'a pas pu être créé." };
  return ok();
}

/** Supprime un dossier vide (sans sous-dossier ni fichier, corbeille comprise). */
export async function deleteFolder(_: FichierState, form: FormData): Promise<FichierState> {
  const id = uuid(form.get("id"));
  if (!id) return { error: "Dossier introuvable." };
  const { supabase } = await requireUser();
  const [sub, files] = await Promise.all([
    supabase.from("folders").select("id", { count: "exact", head: true }).eq("parent_id", id),
    supabase.from("files").select("id", { count: "exact", head: true }).eq("folder_id", id),
  ]);
  if ((sub.count ?? 0) + (files.count ?? 0) > 0) return { error: "Vide d'abord le dossier." };
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) return { error: "Le dossier n'a pas pu être supprimé." };
  return ok();
}

export async function renameFile(_: FichierState, form: FormData): Promise<FichierState> {
  const id = uuid(form.get("id"));
  const name = fileNameSchema.safeParse(form.get("name"));
  if (!id) return { error: "Fichier introuvable." };
  if (!name.success) return { error: name.error.issues[0]?.message };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("files").update({ name: name.data }).eq("id", id);
  if (error) return { error: "Le nom n'a pas été changé." };
  return ok();
}

export async function toggleStar(form: FormData) {
  const id = uuid(form.get("id"));
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("files").update({ starred: form.get("starred") !== "true" }).eq("id", id);
  revalidatePath("/fichiers");
}

export async function moveFile(_: FichierState, form: FormData): Promise<FichierState> {
  const id = uuid(form.get("id"));
  if (!id) return { error: "Fichier introuvable." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("files").update({ folder_id: uuid(form.get("folderId")) }).eq("id", id);
  if (error) return { error: "Le fichier n'a pas été déplacé." };
  return ok();
}

export async function linkNote(_: FichierState, form: FormData): Promise<FichierState> {
  const id = uuid(form.get("id"));
  if (!id) return { error: "Fichier introuvable." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("files").update({ note_id: uuid(form.get("noteId")) }).eq("id", id);
  if (error) return { error: "La note n'a pas pu être liée." };
  revalidatePath("/notes", "layout");
  return ok();
}

/** « Partager avec un cercle » : publie le fichier dans le cercle, avec un mot facultatif. */
export async function shareToCircle(_: FichierState, form: FormData): Promise<FichierState> {
  const id = uuid(form.get("id"));
  const circleId = uuid(form.get("circleId"));
  const body = String(form.get("body") ?? "").trim().slice(0, 5000);
  if (!id || !circleId) return { error: "Choisis un cercle." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("circle_posts").insert({ circle_id: circleId, body, file_id: id });
  if (error) return { error: "Le fichier n'a pas pu être partagé." };
  revalidatePath("/cercles");
  return ok();
}

export async function trashFile(form: FormData) {
  const id = uuid(form.get("id"));
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("files").update({ trashed_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/fichiers");
}

export async function restoreFile(form: FormData) {
  const id = uuid(form.get("id"));
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("files").update({ trashed_at: null }).eq("id", id);
  revalidatePath("/fichiers");
}

/** Supprime définitivement des fichiers de la corbeille : stockage puis base. */
async function purge(ids: string[] | "tout") {
  const { supabase, user } = await requireUser();
  let q = supabase.from("files").select("id, storage_path").eq("owner_id", user.id).not("trashed_at", "is", null);
  if (ids !== "tout") q = q.in("id", ids);
  const { data } = await q.limit(1000);
  if (!data?.length) return;
  const { error } = await supabase.storage.from("fichiers").remove(data.map((f) => f.storage_path));
  if (error) return;
  await supabase.from("files").delete().in("id", data.map((f) => f.id));
  revalidatePath("/fichiers");
  revalidatePath("/cercles");
}

export async function deleteForever(form: FormData) {
  const id = uuid(form.get("id"));
  if (id) await purge([id]);
}

export async function emptyTrash() {
  await purge("tout");
}
