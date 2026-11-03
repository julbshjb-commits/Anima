import "server-only";
import { requireUser } from "@/lib/auth";
import type { Quote, Work } from "@/lib/database.types";

/** Lectures de la Bibliothèque : tout est personnel (RLS). */

export type Library = {
  works: Work[];
  quotes: Quote[];
  goal: { year: number; target: number | null; done: number };
};

export async function getLibrary(year: number): Promise<Library> {
  const { supabase } = await requireUser();
  const [works, quotes, goal] = await Promise.all([
    supabase.from("works").select("*").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("quotes").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("reading_goals").select("*").eq("year", year).maybeSingle(),
  ]);
  for (const r of [works, quotes]) if (r.error) throw r.error;
  const list = works.data ?? [];
  return {
    works: list,
    quotes: quotes.data ?? [],
    goal: {
      year,
      target: goal.data?.target ?? null,
      done: list.filter((w) => w.kind === "livre" && w.status === "termine" && (w.finished_on ?? w.updated_at).startsWith(String(year))).length,
    },
  };
}

export async function getWork(id: string): Promise<{ work: Work; quotes: Quote[] } | null> {
  const { supabase } = await requireUser();
  const { data: work } = await supabase.from("works").select("*").eq("id", id).maybeSingle();
  if (!work) return null;
  const { data: quotes } = await supabase.from("quotes").select("*").eq("work_id", id).order("created_at", { ascending: false });
  return { work, quotes: quotes ?? [] };
}
