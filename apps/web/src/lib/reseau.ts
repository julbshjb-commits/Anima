import "server-only";
import { requireUser } from "@/lib/auth";
import type { AppNotification, PostComment, PublicPost, PublicProfile } from "@/lib/database.types";

/** Lectures du réseau public. La RLS ne renvoie que ce que l'on a le droit de voir. */

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

export type Author = Pick<PublicProfile, "id" | "handle" | "name" | "avatar_path" | "is_private"> & { avatar: string | null };
export type FeedPost = PublicPost & { author: Author; photo: string | null; liked: boolean };

const AUTHOR_COLS = "id, handle, name, avatar_path, is_private";
const NONE = ["00000000-0000-0000-0000-000000000000"];

/** URL signées (1 h) pour les images du bucket « social ». */
async function sign(supabase: Supa, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (!list.length) return out;
  const { data } = await supabase.storage.from("social").createSignedUrls(list, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}

export async function getMe() {
  const { supabase, user } = await requireUser();
  const [{ data: me }, { data: admin }] = await Promise.all([
    supabase.from("public_profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const signed = await sign(supabase, [me?.avatar_path]);
  return {
    supabase,
    user,
    me: me ? { ...me, avatar: me.avatar_path ? (signed.get(me.avatar_path) ?? null) : null } : null,
    isAdmin: !!admin,
  };
}

/** Complète des publications avec leur auteur, leur photo et mon j'aime. */
async function hydrate(supabase: Supa, userId: string, posts: PublicPost[]): Promise<FeedPost[]> {
  if (!posts.length) return [];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const ids = posts.map((p) => p.id);
  const [{ data: authors }, { data: likes }] = await Promise.all([
    supabase.from("public_profiles").select(AUTHOR_COLS).in("id", authorIds),
    supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", ids),
  ]);
  const signed = await sign(supabase, [...posts.map((p) => p.photo_path), ...(authors ?? []).map((a) => a.avatar_path)]);
  const byId = new Map((authors ?? []).map((a) => [a.id, { ...a, avatar: a.avatar_path ? (signed.get(a.avatar_path) ?? null) : null }]));
  const liked = new Set((likes ?? []).map((l) => l.post_id));
  return posts
    .filter((p) => byId.has(p.author_id))
    .map((p) => ({
      ...p,
      author: byId.get(p.author_id)!,
      photo: p.photo_path ? (signed.get(p.photo_path) ?? null) : null,
      liked: liked.has(p.id),
    }));
}

/** Fil : « pour toi » (tout ce qui est visible, récent d'abord) ou « abonnements ». */
export async function getFeed(supabase: Supa, userId: string, tab: "pour-toi" | "abonnements", before?: string) {
  let q = supabase.from("posts").select("*").is("hidden_at", null).order("created_at", { ascending: false }).limit(30);
  if (before) q = q.lt("created_at", before);
  if (tab === "abonnements") {
    const { data: f } = await supabase.from("follows").select("followee_id").eq("follower_id", userId).eq("status", "accepted");
    const ids = [userId, ...(f ?? []).map((r) => r.followee_id)];
    q = q.in("author_id", ids);
  }
  const { data, error } = await q;
  if (error) throw error;
  return hydrate(supabase, userId, data ?? []);
}

export type Relation = { following: "accepted" | "pending" | null; followsMe: boolean; blocked: boolean };

export async function getProfile(handle: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("public_profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!profile) return { supabase, user, profile: null } as const;
  const isMe = profile.id === user.id;
  const [{ data: out }, { data: inc }, { data: block }, { data: posts }] = await Promise.all([
    supabase.from("follows").select("status").eq("follower_id", user.id).eq("followee_id", profile.id).maybeSingle(),
    supabase.from("follows").select("status").eq("follower_id", profile.id).eq("followee_id", user.id).eq("status", "accepted").maybeSingle(),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", profile.id).maybeSingle(),
    supabase.from("posts").select("*").eq("author_id", profile.id).order("created_at", { ascending: false }).limit(60),
  ]);
  const relation: Relation = { following: out?.status ?? null, followsMe: !!inc, blocked: !!block };
  const canSeePosts = isMe || !profile.is_private || relation.following === "accepted";
  const hydrated = canSeePosts ? await hydrate(supabase, user.id, posts ?? []) : [];
  const signed = await sign(supabase, [profile.avatar_path]);
  return {
    supabase,
    user,
    isMe,
    profile: { ...profile, avatar: profile.avatar_path ? (signed.get(profile.avatar_path) ?? null) : null },
    relation,
    canSeePosts,
    posts: hydrated,
  } as const;
}

export type CommentRow = PostComment & { author: Author };

export async function getPost(id: string) {
  const { supabase, user } = await requireUser();
  const { data: post } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!post) return { user, post: null, comments: [] as CommentRow[] };
  const [hydrated] = await hydrate(supabase, user.id, [post]);
  const { data: comments } = await supabase.from("post_comments").select("*").eq("post_id", id).order("created_at").limit(200);
  const ids = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: authors } = await supabase.from("public_profiles").select(AUTHOR_COLS).in("id", ids.length ? ids : NONE);
  const signed = await sign(supabase, (authors ?? []).map((a) => a.avatar_path));
  const byId = new Map((authors ?? []).map((a) => [a.id, { ...a, avatar: a.avatar_path ? (signed.get(a.avatar_path) ?? null) : null }]));
  return {
    user,
    post: hydrated ?? null,
    comments: (comments ?? []).filter((c) => byId.has(c.author_id)).map((c) => ({ ...c, author: byId.get(c.author_id)! })),
  };
}

export type NotificationRow = AppNotification & { actor: Author; excerpt: string | null; following: boolean };

export async function getNotifications() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(80);
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((n) => n.actor_id))];
  const postIds = [...new Set(rows.map((n) => n.post_id).filter((v): v is string => !!v))];
  const [{ data: actors }, { data: posts }, { data: follows }] = await Promise.all([
    supabase.from("public_profiles").select(AUTHOR_COLS).in("id", actorIds.length ? actorIds : NONE),
    supabase.from("posts").select("id, body").in("id", postIds.length ? postIds : NONE),
    supabase.from("follows").select("followee_id").eq("follower_id", user.id).in("followee_id", actorIds.length ? actorIds : NONE),
  ]);
  const signed = await sign(supabase, (actors ?? []).map((a) => a.avatar_path));
  const byId = new Map((actors ?? []).map((a) => [a.id, { ...a, avatar: a.avatar_path ? (signed.get(a.avatar_path) ?? null) : null }]));
  const bodies = new Map((posts ?? []).map((p) => [p.id, p.body]));
  const following = new Set((follows ?? []).map((f) => f.followee_id));
  return rows
    .filter((n) => byId.has(n.actor_id))
    .map((n) => ({
      ...n,
      actor: byId.get(n.actor_id)!,
      excerpt: n.post_id ? (bodies.get(n.post_id) ?? null) : null,
      following: following.has(n.actor_id),
    }));
}

/** Nombre de notifications non lues (pastille du menu). */
export async function unreadCount() {
  const { supabase } = await requireUser();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

/** Recherche de profils par pseudo ou nom. */
export async function searchProfiles(supabase: Supa, q: string) {
  const term = q.trim().replace(/^@/, "").replace(/[%_,()]/g, " ").trim();
  if (term.length < 2) return [];
  const { data } = await supabase
    .from("public_profiles")
    .select(`${AUTHOR_COLS}, bio, followers_count`)
    .or(`handle.ilike.%${term}%,name.ilike.%${term}%`)
    .order("followers_count", { ascending: false })
    .limit(20);
  const signed = await sign(supabase, (data ?? []).map((a) => a.avatar_path));
  return (data ?? []).map((a) => ({ ...a, avatar: a.avatar_path ? (signed.get(a.avatar_path) ?? null) : null }));
}

/** Profils à découvrir : les plus suivis que je ne suis pas encore. */
export async function suggestions(supabase: Supa, userId: string) {
  const { data: f } = await supabase.from("follows").select("followee_id").eq("follower_id", userId);
  const skip = [userId, ...(f ?? []).map((r) => r.followee_id)];
  const { data } = await supabase
    .from("public_profiles")
    .select(`${AUTHOR_COLS}, bio, followers_count`)
    .not("id", "in", `(${skip.join(",")})`)
    .order("followers_count", { ascending: false })
    .limit(5);
  const rows = (data ?? []).filter((a) => !skip.includes(a.id));
  const signed = await sign(supabase, rows.map((a) => a.avatar_path));
  return rows.map((a) => ({ ...a, avatar: a.avatar_path ? (signed.get(a.avatar_path) ?? null) : null }));
}

/** Demandes d'abonnement en attente (compte privé). */
export async function pendingRequests(supabase: Supa, userId: string) {
  const { data } = await supabase.from("follows").select("follower_id, created_at").eq("followee_id", userId).eq("status", "pending");
  const ids = (data ?? []).map((r) => r.follower_id);
  if (!ids.length) return [];
  const { data: actors } = await supabase.from("public_profiles").select(AUTHOR_COLS).in("id", ids);
  const signed = await sign(supabase, (actors ?? []).map((a) => a.avatar_path));
  return (actors ?? []).map((a) => ({ ...a, avatar: a.avatar_path ? (signed.get(a.avatar_path) ?? null) : null }));
}

/** File de modération : signalements ouverts, groupés par contenu. */
export async function moderationQueue() {
  const { supabase } = await requireUser();
  const { data: reports } = await supabase.from("reports").select("*").is("resolved_at", null).order("created_at").limit(300);
  const groups = new Map<string, { kind: "post" | "comment" | "profile"; id: string; reasons: Record<string, number>; details: string[]; first: string }>();
  for (const r of reports ?? []) {
    const key = `${r.target_kind}:${r.target_id}`;
    const g = groups.get(key) ?? { kind: r.target_kind, id: r.target_id, reasons: {}, details: [], first: r.created_at };
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.details) g.details.push(r.details);
    groups.set(key, g);
  }
  const list = [...groups.values()];
  const postIds = list.filter((g) => g.kind === "post").map((g) => g.id);
  const commentIds = list.filter((g) => g.kind === "comment").map((g) => g.id);
  const profileIds = list.filter((g) => g.kind === "profile").map((g) => g.id);
  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabase.from("posts").select("id, author_id, body, hidden_at").in("id", postIds.length ? postIds : NONE),
    supabase.from("post_comments").select("id, author_id, body, hidden_at").in("id", commentIds.length ? commentIds : NONE),
  ]);
  const authorIds = [...(posts ?? []).map((p) => p.author_id), ...(comments ?? []).map((c) => c.author_id), ...profileIds];
  const { data: profiles } = await supabase.from("public_profiles").select("id, handle, name, bio, suspended_at").in("id", authorIds.length ? authorIds : NONE);
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const content = new Map<string, { body: string; author: string; hidden: boolean }>();
  for (const p of posts ?? []) content.set(`post:${p.id}`, { body: p.body, author: prof.get(p.author_id)?.handle ?? "?", hidden: !!p.hidden_at });
  for (const c of comments ?? []) content.set(`comment:${c.id}`, { body: c.body, author: prof.get(c.author_id)?.handle ?? "?", hidden: !!c.hidden_at });
  for (const id of profileIds) {
    const p = prof.get(id);
    content.set(`profile:${id}`, { body: p ? `${p.name} — ${p.bio}` : "", author: p?.handle ?? "?", hidden: !!p?.suspended_at });
  }
  return list.map((g) => ({ ...g, content: content.get(`${g.kind}:${g.id}`) ?? null }));
}
