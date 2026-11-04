import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/server";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/env";

export type TokenClient = SupabaseClient<Database>;

/** Client Supabase qui agit avec le jeton de l'appli : la RLS (et ses règles « ai_gate ») s'applique. */
export function tokenClient(token: string): TokenClient {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase n'est pas configuré.");
  return createClient<Database>(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Vérifie le jeton envoyé par l'assistant. On n'accepte que les jetons OAuth
 * (avec client_id) : une session ordinaire n'a rien à faire ici, et sans
 * client_id les règles « ai_gate » ne s'appliqueraient pas.
 */
export async function verifyToken(_req: Request, token?: string): Promise<AuthInfo | undefined> {
  if (!token || token.length > 8192) return undefined;
  try {
    const { data, error } = await tokenClient(token).auth.getClaims(token);
    const c = data?.claims as Record<string, unknown> | undefined;
    if (error || !c) return undefined;
    if (c.role !== "authenticated" || typeof c.sub !== "string" || typeof c.client_id !== "string" || !c.client_id) return undefined;
    return {
      token,
      clientId: c.client_id,
      scopes: typeof c.scope === "string" ? c.scope.split(" ").filter(Boolean) : [],
      expiresAt: typeof c.exp === "number" ? c.exp : undefined,
      extra: { userId: c.sub },
    };
  } catch {
    return undefined;
  }
}
