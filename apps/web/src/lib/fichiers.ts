import "server-only";
import { isImage } from "@anima/core";
import { requireUser } from "@/lib/auth";
import type { FileRow, Folder } from "@/lib/database.types";

/**
 * Lectures de l'espace « Fichiers ». La RLS ne renvoie que ses propres
 * fichiers, plus ceux qu'un membre a joints à un carnet ou un cercle commun.
 */

export type Vue = "disque" | "partages" | "recents" | "favoris" | "corbeille";
export const VUES: Vue[] = ["disque", "partages", "recents", "favoris", "corbeille"];

export type FileItem = FileRow & {
  /** « Séance 8 · Droit constit. », « Cercle Coloc », titre de la note liée. */
  linkedTo: string | null;
  /** Prénom de la propriétaire, pour un fichier partagé avec moi. */
  ownerName: string | null;
};

export type FolderItem = Folder & { files: number };

export type Drive = {
  userId: string;
  vue: Vue;
  folder: Folder | null;
  /** Du disque jusqu'au dossier ouvert. */
  path: Folder[];
  folders: FolderItem[];
  allFolders: Folder[];
  files: FileItem[];
  used: number;
  quota: number;
};

const SELECT = "id, owner_id, folder_id, name, storage_path, mime_type, size_bytes, starred, note_id, trashed_at, created_at, updated_at";

export async function getDrive(vue: Vue, folderId: string | null): Promise<Drive | null> {
  const { supabase, user } = await requireUser();
  const mine = () => supabase.from("files").select(SELECT).eq("owner_id", user.id);
  let q;
  switch (vue) {
    case "partages":
      q = supabase.from("files").select(SELECT).neq("owner_id", user.id).is("trashed_at", null).order("created_at", { ascending: false });
      break;
    case "recents":
      q = mine().is("trashed_at", null).order("updated_at", { ascending: false }).limit(30);
      break;
    case "favoris":
      q = mine().is("trashed_at", null).eq("starred", true).order("name");
      break;
    case "corbeille":
      q = mine().not("trashed_at", "is", null).order("trashed_at", { ascending: false });
      break;
    default:
      q = mine().is("trashed_at", null).order("name");
      q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null);
  }
  const [files, folders, counts, used, quota] = await Promise.all([
    q.limit(500),
    supabase.from("folders").select("*").order("name").limit(1000),
    supabase.from("files").select("folder_id").eq("owner_id", user.id).is("trashed_at", null).not("folder_id", "is", null).limit(5000),
    supabase.rpc("storage_used_bytes"),
    supabase.rpc("file_quota_bytes"),
  ]);
  for (const r of [files, folders, counts]) if (r.error) throw r.error;
  const all = folders.data ?? [];
  const folder = folderId ? (all.find((f) => f.id === folderId) ?? null) : null;
  if (folderId && !folder) return null;

  const path: Folder[] = [];
  for (let f = folder; f; f = all.find((x) => x.id === f!.parent_id) ?? null) path.unshift(f);

  const perFolder = new Map<string, number>();
  for (const c of counts.data ?? []) if (c.folder_id) perFolder.set(c.folder_id, (perFolder.get(c.folder_id) ?? 0) + 1);

  return {
    userId: user.id,
    vue,
    folder,
    path,
    folders:
      vue === "disque"
        ? all.filter((f) => f.parent_id === (folderId ?? null)).map((f) => ({ ...f, files: perFolder.get(f.id) ?? 0 }))
        : [],
    allFolders: all,
    files: await describe(files.data ?? [], user.id),
    used: Number(used.data ?? 0),
    quota: Number(quota.data ?? 0),
  };
}

/** Ajoute « Lié à » et le prénom de la propriétaire. */
async function describe(rows: FileRow[], userId: string): Promise<FileItem[]> {
  if (!rows.length) return [];
  const { supabase } = await requireUser();
  const ids = rows.map((f) => f.id);
  const [blocks, posts] = await Promise.all([
    supabase.from("note_blocks").select("file_id, note_id").in("file_id", ids),
    supabase.from("circle_posts").select("file_id, circle_id").in("file_id", ids),
  ]);
  const noteIds = [...new Set([...rows.map((f) => f.note_id), ...(blocks.data ?? []).map((b) => b.note_id)].filter(Boolean) as string[])];
  const circleIds = [...new Set((posts.data ?? []).map((p) => p.circle_id))];
  const ownerIds = [...new Set(rows.map((f) => f.owner_id).filter((id) => id !== userId))];
  const [notes, circles, owners] = await Promise.all([
    noteIds.length ? supabase.from("notes").select("id, title").in("id", noteIds) : { data: [] },
    circleIds.length ? supabase.from("circles").select("id, name").in("id", circleIds) : { data: [] },
    ownerIds.length ? supabase.from("profiles").select("id, display_name").in("id", ownerIds) : { data: [] },
  ]);
  const noteTitle = new Map((notes.data ?? []).map((n) => [n.id, n.title]));
  const circleName = new Map((circles.data ?? []).map((c) => [c.id, c.name]));
  const ownerName = new Map((owners.data ?? []).map((p) => [p.id, p.display_name]));
  return rows.map((f) => {
    const b = (blocks.data ?? []).find((x) => x.file_id === f.id);
    const p = (posts.data ?? []).find((x) => x.file_id === f.id);
    const linkedTo =
      (f.note_id && noteTitle.get(f.note_id)) ||
      (b && noteTitle.get(b.note_id) && `Séance · ${noteTitle.get(b.note_id)}`) ||
      (p && circleName.get(p.circle_id) && `Cercle · ${circleName.get(p.circle_id)}`) ||
      null;
    return { ...f, linkedTo, ownerName: f.owner_id === userId ? null : (ownerName.get(f.owner_id) ?? "Un membre") };
  });
}

export type FileDetail = {
  file: FileItem;
  mine: boolean;
  /** URL signée de 10 minutes pour l'aperçu (image ou PDF). */
  previewUrl: string | null;
  notes: { id: string; title: string }[];
  circles: { id: string; name: string }[];
};

export async function getFileDetail(id: string): Promise<FileDetail | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("files").select(SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const [file] = await describe([data], user.id);
  const mine = data.owner_id === user.id;
  const previewable = isImage(data.mime_type) || data.mime_type === "application/pdf";
  const [signed, notes, circles] = await Promise.all([
    previewable && !data.trashed_at ? supabase.storage.from("fichiers").createSignedUrl(data.storage_path, 600) : null,
    mine ? supabase.from("notes").select("id, title").order("updated_at", { ascending: false }).limit(200) : { data: [] },
    mine ? supabase.from("circles").select("id, name").order("name") : { data: [] },
  ]);
  return {
    file: file!,
    mine,
    previewUrl: signed?.data?.signedUrl ?? null,
    notes: notes.data ?? [],
    circles: circles.data ?? [],
  };
}

/** URL signées (1 h) des fichiers joints, par id de fichier ; ignore ceux qu'on ne peut pas lire. */
export async function signFiles(fileIds: string[]): Promise<Map<string, { url: string; name: string; mime: string; size: number }>> {
  const out = new Map<string, { url: string; name: string; mime: string; size: number }>();
  const ids = [...new Set(fileIds)];
  if (!ids.length) return out;
  const { supabase } = await requireUser();
  const { data: files } = await supabase.from("files").select("id, name, storage_path, mime_type, size_bytes").in("id", ids);
  if (!files?.length) return out;
  const { data: signed } = await supabase.storage.from("fichiers").createSignedUrls(files.map((f) => f.storage_path), 3600);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  for (const f of files) {
    const url = byPath.get(f.storage_path);
    if (url) out.set(f.id, { url, name: f.name, mime: f.mime_type, size: f.size_bytes });
  }
  return out;
}
