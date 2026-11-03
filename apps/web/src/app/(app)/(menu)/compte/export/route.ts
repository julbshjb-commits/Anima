import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Export des données personnelles (RGPD, article 20) : profil, journaux dont
 * on est membre, et toutes les entrées qu'on a écrites, au format JSON.
 */
export async function GET() {
  // Jamais prérendu au build : la réponse dépend de la session de la personne.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const uid = auth.user.id;

  const [profile, memberships, entries, attachments] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("journal_members").select("role, joined_at, journal:journals(id, title, kind, created_at)").eq("user_id", uid),
    supabase
      .from("journal_entries")
      .select("id, journal_id, entry_date, title, content_text, mood, created_at, updated_at")
      .eq("author_id", uid)
      .is("deleted_at", null)
      .order("entry_date"),
    supabase.from("attachments").select("id, journal_id, entry_id, storage_path, mime_type, size_bytes, created_at").eq("owner_id", uid),
  ]);

  const body = {
    exporte_le: new Date().toISOString(),
    compte: { id: uid, email: auth.user.email, cree_le: auth.user.created_at },
    profil: profile.data,
    journaux: memberships.data,
    entrees: entries.data,
    photos: attachments.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="anima-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
