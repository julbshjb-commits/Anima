"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  blockContentSchema,
  blockSchema,
  noteSchema,
  notebookSchema,
  parseQuickTask,
  seanceSchema,
  seanceToText,
  taskSchema,
  todayIn,
} from "@anima/core";
import { requireUser } from "@/lib/auth";

export type NotesState = { error?: string; ok?: number; code?: string };

const uuid = (v: FormDataEntryValue | null) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const ok = (...paths: string[]): NotesState => {
  revalidatePath("/notes");
  for (const p of paths) revalidatePath(p);
  return { ok: Date.now() };
};

/** Nouveau carnet perso ou carnet de cours partagé. */
export async function createNotebook(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const parsed = notebookSchema.safeParse({
    title: form.get("title"),
    kind: form.get("kind") || undefined,
    subtitle: form.get("subtitle") ?? "",
    cover: form.get("cover") || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Carnet invalide." };
  const { data, error } = await supabase
    .from("notebooks")
    .insert(parsed.data)
    .select("id, kind")
    .single();
  if (error || !data)
    return { error: "Le carnet n'a pas pu être créé. Réessaie." };
  revalidatePath("/notes");
  redirect(
    data.kind === "cours"
      ? `/notes/cours/${data.id}`
      : `/notes?carnet=${data.id}`,
  );
}

/** Crée une note vide dans un carnet perso et ouvre l'éditeur. */
export async function createNote(form: FormData) {
  const { supabase } = await requireUser();
  const notebookId = uuid(form.get("notebookId"));
  if (!notebookId) return;
  const { data, error } = await supabase
    .from("notes")
    .insert({ notebook_id: notebookId, title: "Sans titre" })
    .select("id")
    .single();
  if (error || !data) redirect(`/notes?carnet=${notebookId}&erreur=1`);
  revalidatePath("/notes");
  redirect(`/notes/${data.id}`);
}

export async function saveNote(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (!id) return { error: "Note introuvable." };
  const parsed = noteSchema.safeParse({
    title: form.get("title"),
    body: form.get("body") ?? "",
    tags: form.get("tags") ?? "",
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Note invalide." };
  const { error, count } = await supabase
    .from("notes")
    .update(parsed.data, { count: "exact" })
    .eq("id", id);
  if (error || !count) return { error: "La note n'a pas pu être enregistrée." };
  return ok(`/notes/${id}`);
}

export async function deleteNote(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  const back = uuid(form.get("notebookId"));
  if (id) await supabase.from("notes").delete().eq("id", id);
  revalidatePath("/notes");
  redirect(back ? `/notes?carnet=${back}` : "/notes");
}

/** « Transformer en tâche » : la tâche arrive dans M'organiser, reliée à la note. */
export async function noteToTask(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const noteId = uuid(form.get("noteId"));
  if (!noteId) return { error: "Note introuvable." };
  const quick = parseQuickTask(String(form.get("title") ?? ""));
  const parsed = taskSchema.safeParse({
    title: quick.title,
    dueDate: quick.dueDate,
    dueTime: quick.dueTime,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Tâche invalide." };
  const t = parsed.data;
  const { error } = await supabase
    .from("tasks")
    .insert({
      title: t.title,
      due_date: t.dueDate,
      due_time: t.dueTime,
      note_id: noteId,
    });
  if (error) return { error: "La tâche n'a pas pu être créée." };
  revalidatePath("/organiser");
  revalidatePath("/aujourdhui");
  return ok(`/notes/${noteId}`, String(form.get("path") ?? "/notes"));
}

export async function toggleNoteTask(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id)
    await supabase
      .from("tasks")
      .update({
        done_at: form.get("done") === "1" ? new Date().toISOString() : null,
      })
      .eq("id", id);
  revalidatePath("/organiser");
  revalidatePath("/aujourdhui");
  ok(String(form.get("path") ?? "/notes"));
}

// ---------------------------------------------------------------------
// Carnets de cours partagés
// ---------------------------------------------------------------------

export async function addSeance(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const notebookId = uuid(form.get("notebookId"));
  if (!notebookId) return { error: "Carnet introuvable." };
  const parsed = seanceSchema.safeParse({
    title: form.get("title"),
    sessionDate: form.get("sessionDate") || todayIn(),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Séance invalide." };
  const { data, error } = await supabase
    .from("notes")
    .insert({
      notebook_id: notebookId,
      title: parsed.data.title,
      session_date: parsed.data.sessionDate,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "La séance n'a pas pu être créée." };
  revalidatePath(`/notes/cours/${notebookId}`);
  redirect(`/notes/cours/${notebookId}?seance=${data.id}`);
}

export async function addBlock(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const noteId = uuid(form.get("noteId"));
  const notebookId = uuid(form.get("notebookId"));
  if (!noteId || !notebookId) return { error: "Séance introuvable." };
  const fileId = uuid(form.get("fileId"));
  const parsed = blockSchema.safeParse({
    kind: form.get("kind") || undefined,
    content: form.get("content") ?? "",
    hasFile: !!fileId,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Passage invalide." };
  const { error } = await supabase
    .from("note_blocks")
    .insert({ note_id: noteId, notebook_id: notebookId, ...parsed.data, file_id: fileId });
  if (error)
    return { error: "Ton ajout n'a pas pu être enregistré. Réessaie." };
  return ok(`/notes/cours/${notebookId}`);
}

export async function updateBlock(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  const notebookId = uuid(form.get("notebookId"));
  const content = blockContentSchema.safeParse(form.get("content"));
  if (!id || !content.success)
    return {
      error: content.error?.issues[0]?.message ?? "Passage introuvable.",
    };
  const { error, count } = await supabase
    .from("note_blocks")
    .update({ content: content.data }, { count: "exact" })
    .eq("id", id);
  if (error || !count)
    return { error: "Tu ne peux modifier que tes propres passages." };
  return ok(`/notes/cours/${notebookId}`);
}

export async function deleteBlock(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("note_blocks").delete().eq("id", id);
  ok(`/notes/cours/${uuid(form.get("notebookId"))}`);
}

export async function toggleQuestion(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.rpc("toggle_question", { p_block_id: id });
  ok(`/notes/cours/${uuid(form.get("notebookId"))}`);
}

/** Code d'invitation au carnet de cours, montré une seule fois. */
export async function createNotebookInvite(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const notebookId = uuid(form.get("notebookId"));
  if (!notebookId) return { error: "Carnet introuvable." };
  const { data, error } = await supabase.rpc("create_notebook_invite", {
    p_notebook_id: notebookId,
  });
  const row = data?.[0];
  if (error || !row)
    return { error: "Impossible de créer une invitation pour ce carnet." };
  return { code: row.code, ok: Date.now() };
}

/** Recopie la séance (texte de chacun, signé) dans une nouvelle note perso. */
export async function copySeance(
  _: NotesState,
  form: FormData,
): Promise<NotesState> {
  const { supabase } = await requireUser();
  const noteId = uuid(form.get("noteId"));
  const target = uuid(form.get("target"));
  if (!noteId || !target) return { error: "Choisis un carnet perso." };
  const { data: note } = await supabase
    .from("notes")
    .select("title, notebook_id")
    .eq("id", noteId)
    .maybeSingle();
  if (!note) return { error: "Séance introuvable." };
  const { data: blocks } = await supabase
    .from("note_blocks")
    .select("kind, content, author_id")
    .eq("note_id", noteId)
    .order("created_at");
  const ids = [...new Set((blocks ?? []).map((b) => b.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids.length ? ids : [noteId]);
  const name = (id: string) =>
    profiles?.find((p) => p.id === id)?.display_name ?? "Ancien membre";
  const body = seanceToText(
    (blocks ?? []).map((b) => ({
      kind: b.kind,
      content: b.content,
      author: name(b.author_id),
    })),
  );
  const { data, error } = await supabase
    .from("notes")
    .insert({
      notebook_id: target,
      title: note.title.slice(0, 120),
      body: body.slice(0, 100000),
      tags: ["cours"],
    })
    .select("id")
    .single();
  if (error || !data) return { error: "La copie n'a pas pu être créée." };
  revalidatePath("/notes");
  redirect(`/notes/${data.id}`);
}

export async function leaveNotebook(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("notebookId"));
  if (id) await supabase.rpc("leave_notebook", { p_notebook_id: id });
  revalidatePath("/notes");
  redirect("/notes");
}

export async function deleteNotebook(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("notebookId"));
  if (id && form.get("confirm") === "oui")
    await supabase.from("notebooks").delete().eq("id", id);
  revalidatePath("/notes");
  redirect("/notes");
}
