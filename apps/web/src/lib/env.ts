/**
 * Variables d'environnement publiques de Supabase.
 * La clé « publishable » peut être exposée au navigateur : c'est la RLS
 * de Postgres qui protège les données. La clé secrète, elle, ne doit
 * jamais apparaître ici (voir src/lib/supabase/admin.ts).
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export class MissingSupabaseEnvError extends Error {
  constructor() {
    super("Anima n'est pas encore relié à sa base de données Supabase.");
    this.name = "MissingSupabaseEnvError";
  }
}
