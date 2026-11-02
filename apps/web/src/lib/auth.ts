import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Couche d'accès : renvoie l'utilisateur vérifié auprès du serveur d'auth
 * et un client Supabase lié à sa session. Redirige vers /connexion sinon.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/connexion");
  return { supabase, user: data.user };
}
