import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Retour du lien e-mail : échange le code contre une session, puis redirige. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const suite = searchParams.get("suite");
  // Uniquement une page d'Anima : « /\\site.com » serait lu comme une autre adresse.
  const dest = suite && suite.startsWith("/") ? new URL(suite, origin) : null;
  const next = dest && dest.origin === origin ? dest.pathname + dest.search : "/aujourdhui";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
}
