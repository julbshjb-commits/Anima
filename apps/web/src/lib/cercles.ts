import "server-only";
import { requireUser } from "@/lib/auth";
import { signFiles } from "@/lib/fichiers";
import type { Circle, CircleComment, CirclePost, CircleReaction } from "@/lib/database.types";

/** Lectures de l'espace « Cercles ». La RLS ne renvoie que les cercles dont on est membre. */

export type CircleCard = Circle & { members: number; unread: number; lastSeen: string };

export type CerclesData = {
  userId: string;
  circles: CircleCard[];
  posts: CirclePost[];
  reactions: CircleReaction[];
  comments: CircleComment[];
  names: Record<string, string>;
  /** Membres (dans l'ordre d'arrivée) par cercle. */
  members: Record<string, { id: string; role: "owner" | "member" }[]>;
  /** Publications déjà ajoutées à mon agenda. */
  inAgenda: string[];
  /** Fichiers joints lisibles (URL signées d'une heure), par id de fichier. */
  files: Map<string, { url: string; name: string; mime: string; size: number }>;
};

export async function getCercles(circleId: string | null): Promise<CerclesData> {
  const { supabase, user } = await requireUser();
  const [circles, members] = await Promise.all([
    supabase.from("circles").select("*").order("created_at"),
    supabase.from("circle_members").select("circle_id, user_id, role, joined_at, last_seen_at").order("joined_at"),
  ]);
  for (const r of [circles, members]) if (r.error) throw r.error;
  const mine = new Map((members.data ?? []).filter((m) => m.user_id === user.id).map((m) => [m.circle_id, m.last_seen_at]));

  let q = supabase.from("circle_posts").select("*").order("created_at", { ascending: false }).limit(40);
  if (circleId) q = q.eq("circle_id", circleId);
  const { data: posts, error } = await q;
  if (error) throw error;
  const ids = (posts ?? []).map((p) => p.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [reactions, comments, recent, agenda, files] = await Promise.all([
    supabase.from("circle_reactions").select("*").in("post_id", ids.length ? ids : none),
    supabase.from("circle_comments").select("*").in("post_id", ids.length ? ids : none).order("created_at"),
    // Pour compter les nouveautés : publications des autres depuis ma dernière visite.
    supabase
      .from("circle_posts")
      .select("circle_id, author_id, created_at")
      .neq("author_id", user.id)
      .gte("created_at", [...mine.values()].sort()[0] ?? new Date().toISOString()),
    supabase.from("events").select("circle_post_id").in("circle_post_id", ids.length ? ids : none),
    signFiles((posts ?? []).map((p) => p.file_id).filter((v): v is string => !!v)),
  ]);
  for (const r of [reactions, comments, recent, agenda]) if (r.error) throw r.error;

  const userIds = [...new Set((members.data ?? []).map((m) => m.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds.length ? userIds : [user.id]);
  const names: Record<string, string> = {};
  for (const p of profiles ?? []) names[p.id] = p.display_name;

  const byCircle: CerclesData["members"] = {};
  for (const m of members.data ?? []) (byCircle[m.circle_id] ??= []).push({ id: m.user_id, role: m.role });

  return {
    userId: user.id,
    circles: (circles.data ?? []).map((c) => {
      const seen = mine.get(c.id) ?? c.created_at;
      return {
        ...c,
        members: byCircle[c.id]?.length ?? 0,
        lastSeen: seen,
        unread: (recent.data ?? []).filter((p) => p.circle_id === c.id && p.created_at > seen).length,
      };
    }),
    posts: posts ?? [],
    reactions: reactions.data ?? [],
    comments: comments.data ?? [],
    names,
    members: byCircle,
    inAgenda: (agenda.data ?? []).map((e) => e.circle_post_id).filter((v): v is string => !!v),
    files,
  };
}

/** Nombre de nouveautés, pour l'accueil. */
export async function getCirclesUnread(): Promise<number> {
  const { supabase, user } = await requireUser();
  const { data: mine } = await supabase.from("circle_members").select("circle_id, last_seen_at").eq("user_id", user.id);
  if (!mine?.length) return 0;
  const oldest = mine.map((m) => m.last_seen_at).sort()[0];
  const { data } = await supabase.from("circle_posts").select("circle_id, created_at").neq("author_id", user.id).gte("created_at", oldest);
  return (data ?? []).filter((p) => p.created_at > (mine.find((m) => m.circle_id === p.circle_id)?.last_seen_at ?? p.created_at)).length;
}
