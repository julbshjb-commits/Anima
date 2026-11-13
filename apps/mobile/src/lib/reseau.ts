/**
 * Le réseau public dans l'appli mobile : mêmes requêtes que
 * apps/web/src/lib/reseau.ts et les actions de /decouvrir. Tout passe par la
 * session de la personne : c'est la RLS (migration 14) qui décide de ce
 * qu'elle voit et de ce qu'elle peut écrire.
 */
import {
  containsBlockedWords,
  MAX_SOCIAL_IMAGE_BYTES,
  publicCommentSchema,
  publicPostSchema,
  publicProfileSchema,
  SOCIAL_IMAGE_TYPES,
  socialPath,
  type AppNotification,
  type Mood,
  type PostComment,
  type PublicPost,
  type PublicPostSource,
  type PublicProfile,
  type ReportReason,
} from '@anima/core';
import { randomUUID } from 'expo-crypto';

import { requireClient } from './supabase';

export type Author = Pick<PublicProfile, 'id' | 'handle' | 'name' | 'avatar_path' | 'is_private'> & { avatar: string | null };
export type FeedPost = PublicPost & { author: Author; photo: string | null; liked: boolean };
export type Suggestion = Author & { bio: string; followers_count: number };
export type MyProfile = PublicProfile & { avatar: string | null };
export type Picture = { uri: string; mimeType: string; size: number };

const AUTHOR_COLS = 'id, handle, name, avatar_path, is_private';
const NONE = ['00000000-0000-0000-0000-000000000000'];

/** Liens signés (1 h) pour les images du bucket privé « social ». */
async function sign(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (!list.length) return out;
  const { data } = await requireClient().storage.from('social').createSignedUrls(list, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}

const withAvatar = <T extends { avatar_path: string | null }>(row: T, signed: Map<string, string>) => ({
  ...row,
  avatar: row.avatar_path ? (signed.get(row.avatar_path) ?? null) : null,
});

export async function getMe(userId: string): Promise<MyProfile | null> {
  const { data, error } = await requireClient().from('public_profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return withAvatar(data, await sign([data.avatar_path]));
}

/** Complète des publications avec leur auteur, leur photo et mon j'aime. */
async function hydrate(userId: string, posts: PublicPost[]): Promise<FeedPost[]> {
  if (!posts.length) return [];
  const supabase = requireClient();
  const [{ data: authors }, { data: likes }] = await Promise.all([
    supabase.from('public_profiles').select(AUTHOR_COLS).in('id', [...new Set(posts.map((p) => p.author_id))]),
    supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', posts.map((p) => p.id)),
  ]);
  const signed = await sign([...posts.map((p) => p.photo_path), ...(authors ?? []).map((a) => a.avatar_path)]);
  const byId = new Map((authors ?? []).map((a) => [a.id, withAvatar(a, signed)]));
  const liked = new Set((likes ?? []).map((l) => l.post_id));
  return posts
    .filter((p) => byId.has(p.author_id))
    .map((p) => ({ ...p, author: byId.get(p.author_id)!, photo: p.photo_path ? (signed.get(p.photo_path) ?? null) : null, liked: liked.has(p.id) }));
}

export type FeedTab = 'pour-toi' | 'abonnements';

/** Fil : « pour toi » (tout ce qui est visible, récent d'abord) ou « abonnements ». */
export async function getFeed(userId: string, tab: FeedTab, before?: string): Promise<FeedPost[]> {
  const supabase = requireClient();
  let q = supabase.from('posts').select('*').is('hidden_at', null).order('created_at', { ascending: false }).limit(30);
  if (before) q = q.lt('created_at', before);
  if (tab === 'abonnements') {
    const { data: f } = await supabase.from('follows').select('followee_id').eq('follower_id', userId).eq('status', 'accepted');
    q = q.in('author_id', [userId, ...(f ?? []).map((r) => r.followee_id)]);
  }
  const { data, error } = await q;
  if (error) throw error;
  return hydrate(userId, data ?? []);
}

/** Tout ce qu'il faut pour l'écran Découvrir. */
export async function loadDiscover(userId: string, tab: FeedTab) {
  const me = await getMe(userId);
  if (!me) return { me: null, posts: [] as FeedPost[], unread: 0 };
  const supabase = requireClient();
  const [posts, { count }] = await Promise.all([
    getFeed(userId, tab),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  return { me, posts, unread: count ?? 0 };
}

export type Relation = { following: 'accepted' | 'pending' | null; followsMe: boolean; blocked: boolean };

export async function getProfile(userId: string, handle: string) {
  const supabase = requireClient();
  const { data: profile, error } = await supabase.from('public_profiles').select('*').eq('handle', handle.toLowerCase()).maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const isMe = profile.id === userId;
  const [{ data: out }, { data: inc }, { data: block }, { data: posts }, me] = await Promise.all([
    supabase.from('follows').select('status').eq('follower_id', userId).eq('followee_id', profile.id).maybeSingle(),
    supabase.from('follows').select('status').eq('follower_id', profile.id).eq('followee_id', userId).eq('status', 'accepted').maybeSingle(),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId).eq('blocked_id', profile.id).maybeSingle(),
    supabase.from('posts').select('*').eq('author_id', profile.id).order('created_at', { ascending: false }).limit(60),
    isMe ? Promise.resolve(true) : supabase.from('public_profiles').select('id').eq('id', userId).maybeSingle().then((r) => !!r.data),
  ]);
  const relation: Relation = { following: out?.status ?? null, followsMe: !!inc, blocked: !!block };
  const canSeePosts = isMe || !profile.is_private || relation.following === 'accepted';
  const signed = await sign([profile.avatar_path]);
  return {
    isMe,
    /** Faux quand je n'ai pas encore de profil public : je peux lire, pas m'abonner. */
    hasProfile: me,
    profile: withAvatar(profile, signed),
    relation,
    canSeePosts,
    posts: canSeePosts ? await hydrate(userId, posts ?? []) : [],
  };
}

export type CommentRow = PostComment & { author: Author };

export async function getPost(userId: string, id: string) {
  const supabase = requireClient();
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!post) return null;
  const [hydrated] = await hydrate(userId, [post]);
  if (!hydrated) return null;
  const { data: comments } = await supabase.from('post_comments').select('*').eq('post_id', id).order('created_at').limit(200);
  const ids = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: authors } = await supabase.from('public_profiles').select(AUTHOR_COLS).in('id', ids.length ? ids : NONE);
  const signed = await sign((authors ?? []).map((a) => a.avatar_path));
  const byId = new Map((authors ?? []).map((a) => [a.id, withAvatar(a, signed)]));
  const rows: CommentRow[] = (comments ?? []).filter((c) => byId.has(c.author_id)).map((c) => ({ ...c, author: byId.get(c.author_id)! }));
  return { post: hydrated, comments: rows };
}

export type NotificationRow = AppNotification & { actor: Author; excerpt: string | null };

/** Notifications récentes + demandes d'abonnement en attente (compte privé). */
export async function getNotifications(userId: string) {
  const supabase = requireClient();
  const [{ data, error }, { data: pending }] = await Promise.all([
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(80),
    supabase.from('follows').select('follower_id').eq('followee_id', userId).eq('status', 'pending'),
  ]);
  if (error) throw error;
  const rows = data ?? [];
  const pendingIds = (pending ?? []).map((r) => r.follower_id);
  const actorIds = [...new Set([...rows.map((n) => n.actor_id), ...pendingIds])];
  const postIds = [...new Set(rows.map((n) => n.post_id).filter((v): v is string => !!v))];
  const [{ data: actors }, { data: posts }] = await Promise.all([
    supabase.from('public_profiles').select(AUTHOR_COLS).in('id', actorIds.length ? actorIds : NONE),
    supabase.from('posts').select('id, body').in('id', postIds.length ? postIds : NONE),
  ]);
  const signed = await sign((actors ?? []).map((a) => a.avatar_path));
  const byId = new Map((actors ?? []).map((a) => [a.id, withAvatar(a, signed)]));
  const bodies = new Map((posts ?? []).map((p) => [p.id, p.body]));
  const list: NotificationRow[] = rows
    .filter((n) => byId.has(n.actor_id) && n.kind !== 'follow_request')
    .map((n) => ({ ...n, actor: byId.get(n.actor_id)!, excerpt: n.post_id ? (bodies.get(n.post_id) ?? null) : null }));
  return { list, requests: pendingIds.map((id) => byId.get(id)).filter((a): a is Author => !!a) };
}

export async function markNotificationsRead() {
  await requireClient().rpc('mark_notifications_read');
}

/** Recherche de profils par pseudo ou nom ; sans texte, les profils les plus suivis que je ne suis pas. */
export async function searchProfiles(userId: string, q: string): Promise<Suggestion[]> {
  const supabase = requireClient();
  const term = q.trim().replace(/^@/, '').replace(/[%_,()]/g, ' ').trim();
  let query = supabase.from('public_profiles').select(`${AUTHOR_COLS}, bio, followers_count`).order('followers_count', { ascending: false });
  let skip: string[] = [];
  if (term.length >= 2) {
    query = query.or(`handle.ilike.%${term}%,name.ilike.%${term}%`).limit(20);
  } else {
    const { data: f } = await supabase.from('follows').select('followee_id').eq('follower_id', userId);
    skip = [userId, ...(f ?? []).map((r) => r.followee_id)];
    query = query.not('id', 'in', `(${skip.join(',')})`).limit(12);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).filter((a) => !skip.includes(a.id));
  const signed = await sign(rows.map((a) => a.avatar_path));
  return rows.map((a) => withAvatar(a, signed));
}

/* ───────────────────────── Écritures ───────────────────────── */

/** Envoie une image dans mon dossier du bucket « social » et renvoie son chemin. */
async function uploadPicture(userId: string, kind: 'avatar' | 'post', pic: Picture): Promise<string> {
  if (!(SOCIAL_IMAGE_TYPES as readonly string[]).includes(pic.mimeType)) throw new Error('Formats acceptés : JPEG, PNG, WebP.');
  const body = await (await fetch(pic.uri)).arrayBuffer();
  if (body.byteLength > MAX_SOCIAL_IMAGE_BYTES) throw new Error('L’image doit faire moins de 10 Mo.');
  const path = socialPath(userId, kind, pic.mimeType, randomUUID());
  const { error } = await requireClient().storage.from('social').upload(path, body, { contentType: pic.mimeType });
  if (error) throw new Error('L’image n’a pas pu être envoyée. Réessaie.');
  return path;
}

export async function handleAvailable(handle: string): Promise<boolean> {
  const { data } = await requireClient().rpc('handle_available', { p_handle: handle });
  return data !== false;
}

export type ProfileInput = {
  handle: string;
  name: string;
  bio: string;
  isPrivate: boolean;
  /** Nouvelle photo, `null` pour retirer l'actuelle, `undefined` pour ne rien changer. */
  avatar?: Picture | null;
  /** Cases à cocher de la création (15 ans, règles). */
  age?: boolean;
  rules?: boolean;
};

/** Crée ou modifie mon profil public. */
export async function saveProfile(userId: string, input: ProfileInput, existing: PublicProfile | null) {
  const parsed = publicProfileSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Profil invalide.');
  const p = parsed.data;
  if (containsBlockedWords(`${p.handle} ${p.name} ${p.bio}`)) throw new Error('Ce texte ne respecte pas les règles d’Anima.');
  if (!existing) {
    if (!input.age) throw new Error('Le réseau Anima est réservé aux personnes de 15 ans ou plus.');
    if (!input.rules) throw new Error('Accepte les règles de la communauté pour continuer.');
  }
  if (!(await handleAvailable(p.handle))) throw new Error(`@${p.handle} est déjà pris. Essaie une variante.`);

  const supabase = requireClient();
  const row = { handle: p.handle, name: p.name, bio: p.bio, is_private: p.isPrivate };
  if (!existing) {
    // Le profil d'abord : le bucket n'accepte une image que si le profil existe.
    const { error } = await supabase.from('public_profiles').insert({ id: userId, ...row });
    if (error) throw new Error(error.code === '23505' ? 'Ce pseudo vient d’être pris.' : 'Ton profil n’a pas pu être créé.');
    if (input.avatar) {
      const path = await uploadPicture(userId, 'avatar', input.avatar);
      await supabase.from('public_profiles').update({ avatar_path: path }).eq('id', userId);
    }
    return;
  }
  const newPath = input.avatar ? await uploadPicture(userId, 'avatar', input.avatar) : undefined;
  const avatar = input.avatar === null ? { avatar_path: null } : newPath ? { avatar_path: newPath } : {};
  const { error } = await supabase.from('public_profiles').update({ ...row, ...avatar }).eq('id', userId);
  if (error) {
    if (newPath) await supabase.storage.from('social').remove([newPath]);
    throw new Error(error.code === '23505' ? 'Ce pseudo vient d’être pris.' : 'Ton profil n’a pas été enregistré.');
  }
  if (existing.avatar_path && 'avatar_path' in avatar) await supabase.storage.from('social').remove([existing.avatar_path]);
}

/** Quitte le réseau : profil public, publications, abonnés et photos effacés. Rien de privé n'est touché. */
export async function leaveNetwork(userId: string) {
  const supabase = requireClient();
  for (;;) {
    const { data: objects } = await supabase.storage.from('social').list(userId, { limit: 100 });
    if (!objects?.length) break;
    const { error } = await supabase.storage.from('social').remove(objects.map((o) => `${userId}/${o.name}`));
    if (error) break;
  }
  const { error } = await supabase.from('public_profiles').delete().eq('id', userId);
  if (error) throw new Error('Le départ du réseau a échoué. Réessaie.');
}

export type PostInput = { body: string; mood: Mood | null; source: PublicPostSource; quoteBy: string; photo: Picture | null };

export async function createPost(userId: string, input: PostInput) {
  const parsed = publicPostSchema.safeParse({ body: input.body, mood: input.mood, source: input.source, quoteBy: input.quoteBy, hasPhoto: !!input.photo });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Publication invalide.');
  const p = parsed.data;
  if (containsBlockedWords(`${p.body} ${p.quoteBy ?? ''}`)) throw new Error('Cette publication ne respecte pas les règles d’Anima. Reformule-la.');
  const supabase = requireClient();
  const photo = input.photo ? await uploadPicture(userId, 'post', input.photo) : null;
  const { error } = await supabase.from('posts').insert({
    body: p.body,
    mood: p.mood,
    source: p.source,
    quote_by: p.source === 'citation' ? p.quoteBy : null,
    photo_path: photo,
  });
  if (!error) return;
  if (photo) await supabase.storage.from('social').remove([photo]);
  if (error.code === '54000') throw new Error('Tu as beaucoup publié aujourd’hui. Reviens demain.');
  if (error.code === '23503') throw new Error('Crée d’abord ton profil public.');
  throw new Error('La publication n’a pas pu être envoyée. Réessaie.');
}

export async function deletePost(userId: string, id: string) {
  const supabase = requireClient();
  const { data, error } = await supabase.from('posts').delete().eq('id', id).eq('author_id', userId).select('photo_path').maybeSingle();
  if (error) throw new Error('La publication n’a pas pu être supprimée.');
  if (data?.photo_path) await supabase.storage.from('social').remove([data.photo_path]);
}

export async function setLike(userId: string, postId: string, like: boolean): Promise<boolean> {
  const supabase = requireClient();
  const { error } = like
    ? await supabase.from('post_likes').insert({ post_id: postId })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  return !error || error.code === '23505';
}

export async function addComment(postId: string, raw: string) {
  const body = publicCommentSchema.safeParse(raw);
  if (!body.success) throw new Error(body.error.issues[0]?.message ?? 'Commentaire invalide.');
  if (containsBlockedWords(body.data)) throw new Error('Ce commentaire ne respecte pas les règles d’Anima.');
  const { error } = await requireClient().from('post_comments').insert({ post_id: postId, body: body.data });
  if (!error) return;
  if (error.code === '54000') throw new Error('Tu as beaucoup commenté aujourd’hui.');
  if (error.code === '23503') throw new Error('Crée d’abord ton profil public.');
  throw new Error('Le commentaire n’a pas pu être envoyé.');
}

export async function deleteComment(id: string) {
  await requireClient().from('post_comments').delete().eq('id', id);
}

export async function follow(id: string) {
  const { error } = await requireClient().from('follows').insert({ followee_id: id });
  if (!error || error.code === '23505') return;
  if (error.code === '54000') throw new Error('Tu as suivi beaucoup de monde aujourd’hui. Reviens demain.');
  if (error.code === '23503') throw new Error('Crée d’abord ton profil public.');
  throw new Error('L’abonnement n’a pas marché. Réessaie.');
}

export async function unfollow(userId: string, id: string) {
  await requireClient().from('follows').delete().eq('follower_id', userId).eq('followee_id', id);
}

export async function acceptFollower(userId: string, id: string) {
  await requireClient().from('follows').update({ status: 'accepted' }).eq('follower_id', id).eq('followee_id', userId);
}

/** Refuser une demande ou retirer un abonné. */
export async function removeFollower(userId: string, id: string) {
  await requireClient().from('follows').delete().eq('follower_id', id).eq('followee_id', userId);
}

export async function block(id: string) {
  const { error } = await requireClient().from('blocks').insert({ blocked_id: id });
  if (error && error.code !== '23505') throw new Error('Le blocage n’a pas marché. Réessaie.');
}

export async function unblock(userId: string, id: string) {
  await requireClient().from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', id);
}

export type ReportTarget = { kind: 'post' | 'comment' | 'profile'; id: string };

export async function report(target: ReportTarget, reason: ReportReason, details: string) {
  const { error } = await requireClient()
    .from('reports')
    .insert({ target_kind: target.kind, target_id: target.id, reason, details: details.trim().slice(0, 500) });
  if (!error || error.code === '23505') return;
  throw new Error(error.code === '54000' ? 'Trop de signalements aujourd’hui.' : 'Le signalement n’a pas pu être envoyé.');
}
