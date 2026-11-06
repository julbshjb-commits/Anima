"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { containsBlockedWords, publicCommentSchema, publicPostSchema, publicProfileSchema, REPORT_REASONS, type ReportReason } from "@anima/core";
import { requireUser } from "@/lib/auth";

export type SocialState = { error?: string; ok?: number };

const uuid = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const done = (): SocialState => {
  revalidatePath("/", "layout");
  return { ok: Date.now() };
};
/** Chemin d'image envoyé par le navigateur : seulement dans mon dossier du bucket « social ». */
const ownPath = (v: FormDataEntryValue | null, userId: string, kind: "avatar" | "post") =>
  typeof v === "string" && new RegExp(`^${userId}/${kind}-[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(v) ? v : null;

export async function saveProfile(_: SocialState, form: FormData): Promise<SocialState> {
  const { supabase, user } = await requireUser();
  const parsed = publicProfileSchema.safeParse({
    handle: form.get("handle") ?? "",
    name: form.get("name") ?? "",
    bio: form.get("bio") ?? "",
    isPrivate: form.get("isPrivate") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Profil invalide." };
  if (containsBlockedWords(`${parsed.data.handle} ${parsed.data.name} ${parsed.data.bio}`))
    return { error: "Ce texte ne respecte pas les règles d'Anima." };

  const { data: free } = await supabase.rpc("handle_available", { p_handle: parsed.data.handle });
  if (free === false) return { error: `@${parsed.data.handle} est déjà pris. Essaie une variante.` };

  const { data: existing } = await supabase.from("public_profiles").select("id, avatar_path").eq("id", user.id).maybeSingle();
  const avatar = ownPath(form.get("avatarPath"), user.id, "avatar");
  const row = {
    handle: parsed.data.handle,
    name: parsed.data.name,
    bio: parsed.data.bio,
    is_private: parsed.data.isPrivate,
    ...(avatar ? { avatar_path: avatar } : {}),
    ...(form.get("removeAvatar") === "1" ? { avatar_path: null } : {}),
  };
  if (existing) {
    const { error } = await supabase.from("public_profiles").update(row).eq("id", user.id);
    if (error) return { error: error.code === "23505" ? "Ce pseudo vient d'être pris." : "Ton profil n'a pas été enregistré." };
    if (existing.avatar_path && (avatar || form.get("removeAvatar") === "1") && existing.avatar_path !== avatar)
      await supabase.storage.from("social").remove([existing.avatar_path]);
  } else {
    if (form.get("age") !== "on") return { error: "Le réseau Anima est réservé aux personnes de 15 ans ou plus." };
    if (form.get("rules") !== "on") return { error: "Accepte les règles de la communauté pour continuer." };
    const { error } = await supabase.from("public_profiles").insert({ id: user.id, ...row });
    if (error) return { error: error.code === "23505" ? "Ce pseudo vient d'être pris." : "Ton profil n'a pas pu être créé." };
    revalidatePath("/", "layout");
    redirect(`/decouvrir?bienvenue=1`);
  }
  return done();
}

/** Quitte le réseau : profil public, publications, abonnés et photos effacés. Rien de privé n'est touché. */
export async function leaveNetwork(_: SocialState, form: FormData): Promise<SocialState> {
  if (form.get("confirm") !== "QUITTER") return { error: "Écris QUITTER pour confirmer." };
  const { supabase, user } = await requireUser();
  for (;;) {
    const { data: objects } = await supabase.storage.from("social").list(user.id, { limit: 100 });
    if (!objects?.length) break;
    const { error } = await supabase.storage.from("social").remove(objects.map((o) => `${user.id}/${o.name}`));
    if (error) break;
  }
  const { error } = await supabase.from("public_profiles").delete().eq("id", user.id);
  if (error) return { error: "Le départ du réseau a échoué. Réessaie." };
  revalidatePath("/", "layout");
  redirect("/decouvrir");
}

export async function createPost(_: SocialState, form: FormData): Promise<SocialState> {
  const { supabase, user } = await requireUser();
  const photo = ownPath(form.get("photoPath"), user.id, "post");
  const parsed = publicPostSchema.safeParse({
    body: form.get("body") ?? "",
    mood: form.get("mood") || null,
    source: form.get("source") || undefined,
    quoteBy: form.get("quoteBy") ?? "",
    hasPhoto: !!photo,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Publication invalide." };
  if (containsBlockedWords(`${parsed.data.body} ${parsed.data.quoteBy ?? ""}`))
    return { error: "Cette publication ne respecte pas les règles d'Anima. Reformule-la." };
  const { error } = await supabase.from("posts").insert({
    body: parsed.data.body,
    mood: parsed.data.mood,
    source: parsed.data.source,
    quote_by: parsed.data.source === "citation" ? parsed.data.quoteBy : null,
    photo_path: photo,
  });
  if (error) {
    if (photo) await supabase.storage.from("social").remove([photo]);
    if (error.code === "54000") return { error: "Tu as beaucoup publié aujourd'hui. Reviens demain." };
    if (error.code === "23503") return { error: "Crée d'abord ton profil public." };
    return { error: "La publication n'a pas pu être envoyée. Réessaie." };
  }
  if (form.get("from") === "journal") redirect("/decouvrir?onglet=pour-toi");
  return done();
}

export async function deletePost(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = uuid(form.get("id"));
  if (!id) return;
  const { data } = await supabase.from("posts").delete().eq("id", id).eq("author_id", user.id).select("photo_path").maybeSingle();
  if (data?.photo_path) await supabase.storage.from("social").remove([data.photo_path]);
  revalidatePath("/", "layout");
  if (form.get("back")) redirect("/decouvrir");
}

export async function toggleLike(postId: string, like: boolean): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  if (!uuid(postId)) return { ok: false };
  const { error } = like
    ? await supabase.from("post_likes").insert({ post_id: postId })
    : await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
  return { ok: !error || error.code === "23505" };
}

export async function addComment(_: SocialState, form: FormData): Promise<SocialState> {
  const { supabase } = await requireUser();
  const postId = uuid(form.get("postId"));
  const body = publicCommentSchema.safeParse(form.get("body") ?? "");
  if (!postId) return { error: "Publication introuvable." };
  if (!body.success) return { error: body.error.issues[0]?.message };
  if (containsBlockedWords(body.data)) return { error: "Ce commentaire ne respecte pas les règles d'Anima." };
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, body: body.data });
  if (error) return { error: error.code === "54000" ? "Tu as beaucoup commenté aujourd'hui." : "Le commentaire n'a pas pu être envoyé." };
  revalidatePath(`/p/${postId}`);
  return { ok: Date.now() };
}

export async function deleteComment(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("post_comments").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function follow(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("follows").insert({ followee_id: id });
  revalidatePath("/", "layout");
}

export async function unfollow(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", id);
  revalidatePath("/", "layout");
}

export async function acceptFollower(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", id).eq("followee_id", user.id);
  revalidatePath("/", "layout");
}

/** Refuser une demande ou retirer un abonné. */
export async function removeFollower(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("follows").delete().eq("follower_id", id).eq("followee_id", user.id);
  revalidatePath("/", "layout");
}

export async function block(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("blocks").insert({ blocked_id: id });
  revalidatePath("/", "layout");
}

export async function unblock(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
  revalidatePath("/", "layout");
}

export async function report(_: SocialState, form: FormData): Promise<SocialState> {
  const { supabase } = await requireUser();
  const id = uuid(form.get("targetId"));
  const kind = form.get("targetKind");
  const reason = form.get("reason");
  if (!id || (kind !== "post" && kind !== "comment" && kind !== "profile")) return { error: "Contenu introuvable." };
  if (typeof reason !== "string" || !(reason in REPORT_REASONS)) return { error: "Choisis une raison." };
  const details = String(form.get("details") ?? "").trim().slice(0, 500);
  const { error } = await supabase.from("reports").insert({ target_kind: kind, target_id: id, reason: reason as ReportReason, details });
  if (error && error.code !== "23505") return { error: error.code === "54000" ? "Trop de signalements aujourd'hui." : "Le signalement n'a pas pu être envoyé." };
  if (form.get("alsoBlock") === "on") {
    const author = uuid(form.get("authorId"));
    if (author) await supabase.from("blocks").insert({ blocked_id: author });
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function markNotificationsRead() {
  const { supabase } = await requireUser();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/", "layout");
}

export async function moderate(form: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(form.get("id"));
  const kind = form.get("kind");
  const action = form.get("action");
  if (!id || (kind !== "post" && kind !== "comment" && kind !== "profile")) return;
  if (action !== "retire" && action !== "garde" && action !== "suspendu") return;
  await supabase.rpc("moderate", { p_kind: kind, p_target: id, p_action: action });
  revalidatePath("/moderation");
}
