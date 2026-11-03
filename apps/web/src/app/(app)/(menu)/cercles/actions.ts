"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  circleSchema,
  commentSchema,
  postSchema,
  zonedToIso,
} from "@anima/core";
import { requireUser } from "@/lib/auth";

export type CercleState = { error?: string; ok?: number; code?: string };

const uuid = (v: FormDataEntryValue | null) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const str = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const ok = (): CercleState => {
  revalidatePath("/cercles");
  return { ok: Date.now() };
};

export async function createCircle(
  _: CercleState,
  form: FormData,
): Promise<CercleState> {
  const { supabase } = await requireUser();
  const parsed = circleSchema.safeParse({
    name: form.get("name"),
    color: form.get("color") || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Cercle invalide." };
  const { data, error } = await supabase
    .from("circles")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data)
    return { error: "Le cercle n'a pas pu être créé. Réessaie." };
  revalidatePath("/cercles");
  redirect(`/cercles?cercle=${data.id}`);
}

export async function publish(
  _: CercleState,
  form: FormData,
): Promise<CercleState> {
  const { supabase } = await requireUser();
  const circleId = uuid(form.get("circleId"));
  if (!circleId) return { error: "Choisis un cercle." };
  const parsed = postSchema.safeParse({
    kind: form.get("kind") || undefined,
    body: form.get("body") ?? "",
    eventTitle: form.get("eventTitle") ?? "",
    eventDay: str(form.get("eventDay")),
    eventEndDay: str(form.get("eventEndDay")),
    eventTime: str(form.get("eventTime")),
    eventPlace: form.get("eventPlace") ?? "",
    quoteText: form.get("quoteText") ?? "",
    quoteSource: form.get("quoteSource") ?? "",
    hasFile: !!uuid(form.get("fileId")),
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Publication invalide.",
    };
  const { error } = await supabase
    .from("circle_posts")
    .insert({ circle_id: circleId, ...parsed.data, file_id: uuid(form.get("fileId")) });
  if (error)
    return { error: "La publication n'a pas pu être envoyée. Réessaie." };
  return ok();
}

export async function deletePost(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("circle_posts").delete().eq("id", id);
  ok();
}

/** Cœur ou « J'en suis » : ajoute la réaction, ou la retire si elle existe. */
export async function react(form: FormData) {
  const { supabase, user } = await requireUser();
  const postId = uuid(form.get("postId"));
  const circleId = uuid(form.get("circleId"));
  const kind = form.get("kind") === "jensuis" ? "jensuis" : "coeur";
  if (!postId || !circleId) return;
  if (form.get("on") === "1")
    await supabase
      .from("circle_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .eq("kind", kind);
  else
    await supabase
      .from("circle_reactions")
      .insert({ post_id: postId, circle_id: circleId, kind });
  ok();
}

export async function comment(
  _: CercleState,
  form: FormData,
): Promise<CercleState> {
  const { supabase } = await requireUser();
  const postId = uuid(form.get("postId"));
  const circleId = uuid(form.get("circleId"));
  const parsed = commentSchema.safeParse({ body: form.get("body") });
  if (!postId || !circleId) return { error: "Publication introuvable." };
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Commentaire invalide.",
    };
  const { error } = await supabase
    .from("circle_comments")
    .insert({ post_id: postId, circle_id: circleId, body: parsed.data.body });
  if (error) return { error: "Le commentaire n'a pas pu être envoyé." };
  return ok();
}

export async function deleteComment(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("circle_comments").delete().eq("id", id);
  ok();
}

/** Copie l'événement d'une publication dans mon agenda (M'organiser), à moi seul. */
export async function addToAgenda(form: FormData) {
  const { supabase } = await requireUser();
  const postId = uuid(form.get("postId"));
  if (!postId) return;
  const { data: post } = await supabase
    .from("circle_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (!post?.event_title || !post.event_day) return;
  const time = post.event_time?.slice(0, 5) ?? "09:00";
  const starts = zonedToIso(post.event_day, time);
  const ends = post.event_end_day
    ? zonedToIso(post.event_end_day, "18:00")
    : null;
  await supabase.from("events").insert({
    title: post.event_title,
    place: post.event_place,
    color: "tendre",
    starts_at: starts,
    ends_at: ends && ends > starts ? ends : null,
    circle_post_id: post.id,
  });
  revalidatePath("/organiser");
  revalidatePath("/aujourdhui");
  ok();
}

export async function createCircleInvite(
  _: CercleState,
  form: FormData,
): Promise<CercleState> {
  const { supabase } = await requireUser();
  const circleId = uuid(form.get("circleId"));
  if (!circleId) return { error: "Cercle introuvable." };
  const { data, error } = await supabase.rpc("create_circle_invite", {
    p_circle_id: circleId,
  });
  const row = data?.[0];
  if (error || !row)
    return { error: "Impossible de créer une invitation pour ce cercle." };
  return { code: row.code, ok: Date.now() };
}

export async function markSeen(circleId: string | null) {
  const { supabase } = await requireUser();
  await supabase.rpc("mark_circles_seen", {
    p_circle_id:
      circleId && /^[0-9a-f-]{36}$/i.test(circleId) ? circleId : null,
  });
}

export async function leaveCircle(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("circleId"));
  if (id) await supabase.rpc("leave_circle", { p_circle_id: id });
  revalidatePath("/cercles");
  redirect("/cercles");
}

export async function deleteCircle(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("circleId"));
  if (id && form.get("confirm") === "oui")
    await supabase.from("circles").delete().eq("id", id);
  revalidatePath("/cercles");
  redirect("/cercles");
}

/** « Enregistrer dans ma bibliothèque » : copie la citation d'une publication dans mes citations. */
export async function saveQuoteFromPost(
  _: CercleState,
  form: FormData,
): Promise<CercleState> {
  const { supabase } = await requireUser();
  const postId = uuid(form.get("postId"));
  if (!postId) return { error: "Publication introuvable." };
  const { data: post } = await supabase
    .from("circle_posts")
    .select("quote_text, quote_source")
    .eq("id", postId)
    .maybeSingle();
  if (!post?.quote_text) return { error: "Citation introuvable." };
  const { error } = await supabase
    .from("quotes")
    .insert({ text: post.quote_text, source: post.quote_source });
  if (error) return { error: "La citation n'a pas pu être gardée." };
  revalidatePath("/bibliotheque");
  return { ok: Date.now() };
}
