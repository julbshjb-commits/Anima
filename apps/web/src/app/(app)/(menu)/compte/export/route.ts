import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Export des données personnelles (RGPD, article 20) : profil, journaux dont
 * on est membre, toutes les entrées qu'on a écrites, l'organisation, les notes, les cercles, la bibliothèque et la liste des fichiers, au format JSON.
 */
export async function GET() {
  // Jamais prérendu au build : la réponse dépend de la session de la personne.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const uid = auth.user.id;

  const [profile, memberships, entries, attachments, projects, tasks, events, rituals, checks, notebooks, notes, blocks, circles, posts, comments, reactions, works, quotes, goals, folders, files] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("journal_members").select("role, joined_at, journal:journals(id, title, kind, created_at)").eq("user_id", uid),
    supabase
      .from("journal_entries")
      .select("id, journal_id, entry_date, title, content_text, mood, created_at, updated_at")
      .eq("author_id", uid)
      .is("deleted_at", null)
      .order("entry_date"),
    supabase.from("attachments").select("id, journal_id, entry_id, storage_path, mime_type, size_bytes, created_at").eq("owner_id", uid),
    supabase.from("projects").select("*").eq("owner_id", uid),
    supabase.from("tasks").select("*").eq("owner_id", uid),
    supabase.from("events").select("*").eq("owner_id", uid),
    supabase.from("rituals").select("*").eq("owner_id", uid),
    supabase.from("ritual_checks").select("ritual_id, day").eq("owner_id", uid),
    supabase.from("notebook_members").select("role, joined_at, carnet:notebooks(id, title, kind, subtitle, created_at)").eq("user_id", uid),
    supabase.from("notes").select("id, notebook_id, title, body, tags, session_date, created_at, updated_at").eq("author_id", uid),
    supabase.from("note_blocks").select("id, note_id, notebook_id, kind, content, done_at, created_at, updated_at").eq("author_id", uid),
    supabase.from("circle_members").select("role, joined_at, cercle:circles(id, name, created_at)").eq("user_id", uid),
    supabase.from("circle_posts").select("*").eq("author_id", uid),
    supabase.from("circle_comments").select("id, post_id, circle_id, body, created_at").eq("author_id", uid),
    supabase.from("circle_reactions").select("post_id, kind, created_at").eq("user_id", uid),
    supabase.from("works").select("*").eq("owner_id", uid),
    supabase.from("quotes").select("*").eq("owner_id", uid),
    supabase.from("reading_goals").select("year, target").eq("owner_id", uid),
    supabase.from("folders").select("id, parent_id, name, created_at").eq("owner_id", uid),
    supabase.from("files").select("id, folder_id, name, mime_type, size_bytes, starred, note_id, trashed_at, created_at").eq("owner_id", uid),
  ]);

  const body = {
    exporte_le: new Date().toISOString(),
    compte: { id: uid, email: auth.user.email, cree_le: auth.user.created_at },
    profil: profile.data,
    journaux: memberships.data,
    entrees: entries.data,
    photos: attachments.data,
    organiser: { projets: projects.data, taches: tasks.data, agenda: events.data, rituels: rituals.data, rituels_coches: checks.data },
    bibliotheque: { oeuvres: works.data, citations: quotes.data, objectifs: goals.data },
    fichiers: { dossiers: folders.data, fichiers: files.data, note: "Le contenu de chaque fichier se télécharge depuis Mes fichiers." },
    cercles: { cercles: circles.data, publications: posts.data, commentaires: comments.data, reactions: reactions.data },
    notes: { carnets: notebooks.data, notes: notes.data, passages_de_seance: blocks.data },
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="anima-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
