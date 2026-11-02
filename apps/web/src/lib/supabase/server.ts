import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { MissingSupabaseEnvError, supabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/** Client Supabase côté serveur, lié aux cookies de la requête. Un par requête. */
export async function createClient() {
  const env = supabaseEnv();
  if (!env) throw new MissingSupabaseEnvError();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}
