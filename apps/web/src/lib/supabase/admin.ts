import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client « service » : contourne la RLS. Réservé à la suppression de compte,
 * après avoir vérifié l'identité de l'utilisateur avec sa propre session.
 * La clé SUPABASE_SECRET_KEY n'a pas le préfixe NEXT_PUBLIC_ : Next.js ne
 * l'envoie donc jamais au navigateur, et "server-only" empêche tout import client.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
