"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { quoteSchema, todayIn, workSchema } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type BiblioState = { error?: string; ok?: number };

const uuid = (v: FormDataEntryValue | null) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const fields = (form: FormData) =>
  Object.fromEntries(
    [...form.entries()].filter(([k]) => !k.startsWith("$") && k !== "id"),
  );
const ok = (id?: string | null): BiblioState => {
  revalidatePath("/bibliotheque");
  if (id) revalidatePath(`/bibliotheque/${id}`);
  return { ok: Date.now() };
};

export async function addWork(
  _: BiblioState,
  form: FormData,
): Promise<BiblioState> {
  const { supabase } = await requireUser();
  const parsed = workSchema.safeParse(fields(form));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Œuvre invalide." };
  const w = parsed.data;
  if (w.status === "en-cours" && !w.started_on) w.started_on = todayIn();
  if (w.status === "termine" && !w.finished_on) w.finished_on = todayIn();
  const { data, error } = await supabase
    .from("works")
    .insert(w)
    .select("id")
    .single();
  if (error || !data)
    return { error: "L'œuvre n'a pas pu être ajoutée. Réessaie." };
  revalidatePath("/bibliotheque");
  redirect(`/bibliotheque/${data.id}`);
}

export async function updateWork(
  _: BiblioState,
  form: FormData,
): Promise<BiblioState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (!id) return { error: "Œuvre introuvable." };
  const parsed = workSchema.safeParse(fields(form));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Œuvre invalide." };
  const w = parsed.data;
  if (w.status === "termine" && !w.finished_on) w.finished_on = todayIn();
  if (w.status !== "a-lire" && !w.started_on) w.started_on = todayIn();
  const { error, count } = await supabase
    .from("works")
    .update(w, { count: "exact" })
    .eq("id", id);
  if (error || !count)
    return { error: "Les modifications n'ont pas pu être enregistrées." };
  return ok(id);
}

/** « Noter où j'en suis » : met à jour la page (ou l'épisode), et termine l'œuvre à la fin. */
export async function setProgress(
  _: BiblioState,
  form: FormData,
): Promise<BiblioState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  const progress = Number(form.get("progress"));
  if (!id || !Number.isInteger(progress) || progress < 0)
    return { error: "Indique un nombre." };
  const { data: w } = await supabase
    .from("works")
    .select("progress_total")
    .eq("id", id)
    .maybeSingle();
  if (!w) return { error: "Œuvre introuvable." };
  if (w.progress_total && progress > w.progress_total)
    return { error: `Il n'y a que ${w.progress_total} en tout.` };
  const done = !!w.progress_total && progress === w.progress_total;
  const { error } = await supabase
    .from("works")
    .update({
      progress,
      status: done ? "termine" : "en-cours",
      ...(done ? { finished_on: todayIn() } : {}),
    })
    .eq("id", id);
  if (error) return { error: "L'avancement n'a pas pu être enregistré." };
  return ok(id);
}

export async function deleteWork(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("works").delete().eq("id", id);
  revalidatePath("/bibliotheque");
  redirect("/bibliotheque");
}

export async function addQuote(
  _: BiblioState,
  form: FormData,
): Promise<BiblioState> {
  const { supabase } = await requireUser();
  const workId = uuid(form.get("workId"));
  const parsed = quoteSchema.safeParse({
    text: form.get("text"),
    source: form.get("source") ?? "",
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Citation invalide." };
  const { error } = await supabase
    .from("quotes")
    .insert({ ...parsed.data, work_id: workId });
  if (error) return { error: "La citation n'a pas pu être gardée." };
  return ok(workId);
}

export async function deleteQuote(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("quotes").delete().eq("id", id);
  ok(uuid(form.get("workId")));
}

export async function setGoal(
  _: BiblioState,
  form: FormData,
): Promise<BiblioState> {
  const { supabase } = await requireUser();
  const year = Number(form.get("year"));
  const target = Number(form.get("target"));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(target) ||
    target < 1 ||
    target > 1000
  )
    return { error: "Entre 1 et 1000 livres." };
  const { error } = await supabase
    .from("reading_goals")
    .upsert({ year, target }, { onConflict: "owner_id,year" });
  if (error) return { error: "L'objectif n'a pas pu être enregistré." };
  return ok();
}
