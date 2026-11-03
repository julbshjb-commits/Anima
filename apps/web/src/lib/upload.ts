"use client";
import { checkUpload, filePath } from "@anima/core";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Envoie un fichier dans le disque privé (bucket « fichiers ») puis crée sa
 * fiche. La base relit taille et type dans le stockage. Renvoie l'id du
 * fichier, ou un message d'erreur lisible.
 */
export async function uploadToDrive(
  userId: string,
  file: File,
  folderId: string | null = null,
): Promise<{ id: string } | { error: string }> {
  const invalid = checkUpload(file);
  if (invalid) return { error: invalid };
  const supabase = browserClient();
  if (!supabase) return { error: "Le stockage n'est pas encore relié." };
  const path = filePath(userId, crypto.randomUUID(), file.type);
  const up = await supabase.storage.from("fichiers").upload(path, file, { contentType: file.type });
  if (up.error) {
    const full = /row-level security|policy/i.test(up.error.message);
    return { error: full ? "Ton espace de stockage est plein. Vide la corbeille pour faire de la place." : `« ${file.name} » n'a pas pu être envoyé.` };
  }
  const { data, error } = await supabase
    .from("files")
    .insert({ name: file.name.slice(0, 200), storage_path: path, folder_id: folderId })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from("fichiers").remove([path]);
    return { error: `« ${file.name} » n'a pas pu être enregistré.` };
  }
  return { id: data.id };
}
