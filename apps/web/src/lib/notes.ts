import "server-only";
import { requireUser } from "@/lib/auth";
import type { Note, NoteBlock, Notebook, Task } from "@/lib/database.types";

/** Lectures de l'espace « Notes ». La RLS ne renvoie que les carnets dont on est membre. */

export type NotebookCard = Notebook & { notes: number; members: number };
export type NoteRow = Pick<Note, "id" | "notebook_id" | "title" | "tags" | "updated_at" | "session_date" | "body">;

export type NotesHome = {
  userId: string;
  notebooks: NotebookCard[];
  notes: NoteRow[];
  tags: { tag: string; n: number }[];
};

/** Carnets, dernières notes (filtrées par carnet ou par tag) et tags utilisés. */
export async function getNotesHome(filter: { notebookId?: string | null; tag?: string | null }): Promise<NotesHome> {
  const { supabase, user } = await requireUser();
  let q = supabase
    .from("notes")
    .select("id, notebook_id, title, tags, updated_at, session_date, body")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (filter.notebookId) q = q.eq("notebook_id", filter.notebookId);
  if (filter.tag) q = q.contains("tags", [filter.tag]);
  const [notebooks, members, notes, all] = await Promise.all([
    supabase.from("notebooks").select("*").is("archived_at", null).order("created_at"),
    supabase.from("notebook_members").select("notebook_id"),
    q,
    supabase.from("notes").select("notebook_id, tags"),
  ]);
  for (const r of [notebooks, members, notes, all]) if (r.error) throw r.error;
  const counts = new Map<string, number>();
  for (const n of all.data ?? []) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return {
    userId: user.id,
    notebooks: (notebooks.data ?? []).map((nb) => ({
      ...nb,
      notes: (all.data ?? []).filter((n) => n.notebook_id === nb.id).length,
      members: (members.data ?? []).filter((m) => m.notebook_id === nb.id).length,
    })),
    notes: notes.data ?? [],
    tags: [...counts].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag, "fr")),
  };
}

export type NoteDetail = {
  userId: string;
  note: Note;
  notebook: Notebook;
  /** Tâches de la personne connectée nées de cette note. */
  tasks: Task[];
  canEdit: boolean;
};

export async function getNote(id: string): Promise<NoteDetail | null> {
  const { supabase, user } = await requireUser();
  const { data: note } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  if (!note) return null;
  const [notebook, tasks] = await Promise.all([
    supabase.from("notebooks").select("*").eq("id", note.notebook_id).single(),
    supabase.from("tasks").select("*").eq("note_id", id).order("created_at"),
  ]);
  if (notebook.error) throw notebook.error;
  return {
    userId: user.id,
    note,
    notebook: notebook.data,
    tasks: tasks.data ?? [],
    canEdit: note.author_id === user.id || notebook.data.owner_id === user.id,
  };
}

export type Member = { id: string; name: string; role: "owner" | "editor"; joinedAt: string };
export type Seance = Pick<Note, "id" | "title" | "session_date" | "author_id" | "created_at"> & { authors: number; blocks: number };

export type CoursData = {
  userId: string;
  notebook: Notebook;
  members: Member[];
  names: Record<string, string>;
  seances: Seance[];
  current: (Note & { number: number }) | null;
  blocks: NoteBlock[];
  questions: NoteBlock[];
  /** Mes carnets perso, pour « Copier dans mon carnet perso ». */
  persoNotebooks: { id: string; title: string }[];
  tasks: Task[];
};

export async function getCours(notebookId: string, seanceId: string | null): Promise<CoursData | null> {
  const { supabase, user } = await requireUser();
  const { data: notebook } = await supabase.from("notebooks").select("*").eq("id", notebookId).maybeSingle();
  if (!notebook || notebook.kind !== "cours") return null;
  const [members, notes, blocksMeta, questions, perso] = await Promise.all([
    supabase.from("notebook_members").select("user_id, role, joined_at").eq("notebook_id", notebookId).order("joined_at"),
    supabase
      .from("notes")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("session_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("note_blocks").select("note_id, author_id").eq("notebook_id", notebookId),
    supabase.from("note_blocks").select("*").eq("notebook_id", notebookId).eq("kind", "question").order("created_at"),
    supabase.from("notebooks").select("id, title").eq("kind", "perso").eq("owner_id", user.id).is("archived_at", null).order("created_at"),
  ]);
  for (const r of [members, notes, blocksMeta, questions, perso]) if (r.error) throw r.error;

  const ids = (members.data ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids.length ? ids : [user.id]);
  const names: Record<string, string> = {};
  for (const p of profiles ?? []) names[p.id] = p.display_name;

  const list = notes.data ?? [];
  const meta = blocksMeta.data ?? [];
  const seances: Seance[] = list.map((n) => {
    const own = meta.filter((b) => b.note_id === n.id);
    return {
      id: n.id,
      title: n.title,
      session_date: n.session_date,
      author_id: n.author_id,
      created_at: n.created_at,
      blocks: own.length,
      authors: new Set(own.map((b) => b.author_id)).size,
    };
  });
  const idx = seanceId ? list.findIndex((n) => n.id === seanceId) : 0;
  const currentNote = idx >= 0 ? list[idx] : undefined;
  const current = currentNote ? { ...currentNote, number: list.length - idx } : null;

  const [blocks, tasks] = current
    ? await Promise.all([
        supabase.from("note_blocks").select("*").eq("note_id", current.id).order("created_at"),
        supabase.from("tasks").select("*").eq("note_id", current.id).order("created_at"),
      ])
    : [{ data: [] as NoteBlock[] }, { data: [] as Task[] }];

  return {
    userId: user.id,
    notebook,
    members: (members.data ?? []).map((m) => ({ id: m.user_id, name: names[m.user_id] ?? "Membre", role: m.role, joinedAt: m.joined_at })),
    names,
    seances,
    current,
    blocks: blocks.data ?? [],
    questions: questions.data ?? [],
    persoNotebooks: perso.data ?? [],
    tasks: tasks.data ?? [],
  };
}

/** Toutes les séances d'un carnet de cours, de la première à la dernière (fiche de révision). */
export async function getFiche(notebookId: string) {
  const { supabase } = await requireUser();
  const { data: notebook } = await supabase.from("notebooks").select("*").eq("id", notebookId).maybeSingle();
  if (!notebook || notebook.kind !== "cours") return null;
  const [notes, blocks, members] = await Promise.all([
    supabase.from("notes").select("*").eq("notebook_id", notebookId).order("session_date", { ascending: true, nullsFirst: true }).order("created_at"),
    supabase.from("note_blocks").select("*").eq("notebook_id", notebookId).order("created_at"),
    supabase.from("notebook_members").select("user_id").eq("notebook_id", notebookId),
  ]);
  for (const r of [notes, blocks, members]) if (r.error) throw r.error;
  const ids = (members.data ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const names: Record<string, string> = {};
  for (const p of profiles ?? []) names[p.id] = p.display_name;
  return { notebook, notes: notes.data ?? [], blocks: blocks.data ?? [], names };
}
