import { NextResponse, connection, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ouvre un fichier : vérifie l'accès (RLS) puis redirige vers une URL signée
 * d'une minute. ?telecharger=1 force le téléchargement sous son nom.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/fichiers/ouvrir/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/connexion", req.url));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Fichier introuvable", { status: 404 });
  const { data: file } = await supabase.from("files").select("name, storage_path").eq("id", id).maybeSingle();
  if (!file) return new NextResponse("Fichier introuvable", { status: 404 });
  const download = req.nextUrl.searchParams.get("telecharger") === "1";
  const { data } = await supabase.storage
    .from("fichiers")
    .createSignedUrl(file.storage_path, 60, download ? { download: file.name } : undefined);
  if (!data?.signedUrl) return new NextResponse("Fichier indisponible", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
