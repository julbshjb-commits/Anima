import "server-only";
import { zonedToIso } from "@anima/core";
import { requireUser } from "@/lib/auth";
import type { CalendarEvent, Project, Ritual, Task } from "@/lib/database.types";

/** Lectures de l'espace « M'organiser ». La RLS ne renvoie que les lignes de la personne connectée. */

export type OrganiserData = {
  projects: (Project & { open: number })[];
  tasks: Task[];
  events: CalendarEvent[];
  rituals: Ritual[];
  checks: { ritual_id: string; day: string }[];
  counts: { today: number; week: number; done: number };
};

/** Tout ce qu'il faut pour une semaine (du lundi `from` au dimanche `to`, jours à Paris). */
export async function getOrganiser(from: string, to: string, today: string): Promise<OrganiserData> {
  const { supabase } = await requireUser();
  const [projects, tasks, events, rituals, checks, openTasks] = await Promise.all([
    supabase.from("projects").select("*").is("archived_at", null).order("created_at"),
    supabase
      .from("tasks")
      .select("*")
      .or(`and(due_date.gte.${from},due_date.lte.${to}),and(done_at.is.null,due_date.lt.${from}),and(done_at.is.null,due_date.is.null)`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("due_time", { ascending: true, nullsFirst: true })
      .order("created_at"),
    supabase
      .from("events")
      .select("*")
      .gte("starts_at", zonedToIso(from, "00:00"))
      .lt("starts_at", zonedToIso(to, "23:59"))
      .order("starts_at"),
    supabase.from("rituals").select("*").is("archived_at", null).order("created_at"),
    supabase.from("ritual_checks").select("ritual_id, day").gte("day", from).lte("day", to),
    supabase.from("tasks").select("project_id, due_date").is("done_at", null),
  ]);
  for (const r of [projects, tasks, events, rituals, checks, openTasks]) if (r.error) throw r.error;
  const open = openTasks.data ?? [];
  const { count: done } = await supabase.from("tasks").select("id", { count: "exact", head: true }).not("done_at", "is", null);
  return {
    projects: (projects.data ?? []).map((p) => ({ ...p, open: open.filter((t) => t.project_id === p.id).length })),
    tasks: tasks.data ?? [],
    events: events.data ?? [],
    rituals: rituals.data ?? [],
    checks: checks.data ?? [],
    counts: {
      today: open.filter((t) => t.due_date && t.due_date <= today).length,
      week: open.filter((t) => t.due_date && t.due_date >= from && t.due_date <= to).length,
      done: done ?? 0,
    },
  };
}

export async function getDoneTasks(): Promise<Task[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("tasks").select("*").not("done_at", "is", null).order("done_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("done_at", { ascending: true, nullsFirst: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** Tâches du jour : prévues aujourd'hui (faites ou non) et en retard non faites. */
export async function getTodayTasks(today: string): Promise<Task[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .or(`due_date.eq.${today},and(done_at.is.null,due_date.lt.${today})`)
    .order("done_at", { ascending: true, nullsFirst: true })
    .order("due_time", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
