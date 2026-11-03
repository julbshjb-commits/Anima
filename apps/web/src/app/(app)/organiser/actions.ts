"use server";
import { revalidatePath } from "next/cache";
import { eventSchema, parseQuickTask, projectSchema, ritualSchema, taskSchema, zonedToIso } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type OrgState = { error?: string; ok?: number };
const done = (): OrgState => {
  revalidatePath("/organiser");
  revalidatePath("/aujourdhui");
  return { ok: Date.now() };
};
const uuid = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Saisie rapide : « appeler maman demain 18 h », rangée dans un projet si on en a choisi un. */
export async function addTask(_: OrgState, form: FormData): Promise<OrgState> {
  const { supabase } = await requireUser();
  const quick = parseQuickTask(String(form.get("title") ?? ""));
  const fallbackDay = str(form.get("day"));
  const parsed = taskSchema.safeParse({
    title: quick.title,
    projectId: uuid(form.get("projectId")),
    dueDate: quick.dueDate ?? fallbackDay,
    dueTime: quick.dueTime,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tâche invalide." };
  const t = parsed.data;
  const { error } = await supabase
    .from("tasks")
    .insert({ title: t.title, project_id: t.projectId, due_date: t.dueDate, due_time: t.dueTime, duration_min: t.durationMin, note: t.note });
  if (error) return { error: "La tâche n'a pas pu être ajoutée. Réessaie." };
  return done();
}

export async function toggleTask(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (!id) return;
  await supabase.from("tasks").update({ done_at: form.get("done") === "1" ? new Date().toISOString() : null }).eq("id", id);
  done();
}

export async function deleteTask(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("tasks").delete().eq("id", id);
  done();
}

export async function addProject(_: OrgState, form: FormData): Promise<OrgState> {
  const { supabase } = await requireUser();
  const parsed = projectSchema.safeParse({ title: form.get("title"), color: form.get("color") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Projet invalide." };
  const { error } = await supabase.from("projects").insert(parsed.data);
  if (error) return { error: "Le projet n'a pas pu être créé." };
  return done();
}

export async function archiveProject(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("projects").update({ archived_at: new Date().toISOString() }).eq("id", id);
  done();
}

export async function addEvent(_: OrgState, form: FormData): Promise<OrgState> {
  const { supabase } = await requireUser();
  const parsed = eventSchema.safeParse({
    title: form.get("title"),
    place: form.get("place") ?? "",
    color: form.get("color") || undefined,
    day: form.get("day"),
    start: form.get("start"),
    end: str(form.get("end")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Rendez-vous invalide." };
  const e = parsed.data;
  const { error } = await supabase.from("events").insert({
    title: e.title,
    place: e.place,
    color: e.color,
    starts_at: zonedToIso(e.day, e.start),
    ends_at: e.end ? zonedToIso(e.day, e.end) : null,
  });
  if (error) return { error: "Le rendez-vous n'a pas pu être ajouté." };
  return done();
}

export async function deleteEvent(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("events").delete().eq("id", id);
  done();
}

export async function addRitual(_: OrgState, form: FormData): Promise<OrgState> {
  const { supabase } = await requireUser();
  const parsed = ritualSchema.safeParse({ title: form.get("title") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Rituel invalide." };
  const { error } = await supabase.from("rituals").insert(parsed.data);
  if (error) return { error: "Le rituel n'a pas pu être ajouté." };
  return done();
}

export async function toggleRitual(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  const day = String(form.get("day") ?? "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  if (form.get("done") === "1") await supabase.from("ritual_checks").insert({ ritual_id: id, day });
  else await supabase.from("ritual_checks").delete().eq("ritual_id", id).eq("day", day);
  done();
}

export async function archiveRitual(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("rituals").update({ archived_at: new Date().toISOString() }).eq("id", id);
  done();
}
