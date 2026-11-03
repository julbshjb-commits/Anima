import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Pages accessibles sans être connecté. */
const PUBLIC_PATHS = ["/", "/connexion", "/auth/callback", "/confidentialite", "/conditions", "/mentions-legales"];

/**
 * Rafraîchit la session Supabase à chaque requête et protège les pages privées.
 * La vérification qui compte reste côté serveur (RLS + getUser dans les pages) :
 * le proxy n'est qu'une première barrière, pratique pour rediriger tôt.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [h, v] of Object.entries(headers ?? {})) response.headers.set(h, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!signedIn && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/connexion";
    to.search = "";
    to.searchParams.set("suite", pathname);
    return NextResponse.redirect(to);
  }
  if (signedIn && (pathname === "/" || pathname === "/connexion")) {
    const to = request.nextUrl.clone();
    to.pathname = "/aujourdhui";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
