/**
 * Suppression du compte depuis l'appli mobile (exigée par l'App Store).
 * Même déroulé que l'action serveur du web (apps/web/src/app/(app)/compte/actions.ts) :
 *   1. transmettre les journaux partagés (prepare_account_deletion, avec la session de l'utilisateur) ;
 *   2. effacer ses photos du stockage ;
 *   3. supprimer l'utilisateur, ce qui efface en cascade son profil, son journal intime et ses entrées.
 *
 * verify_jwt est désactivé (voir supabase/config.toml) : la session est vérifiée ici,
 * auprès du serveur d'authentification, avant toute action.
 */
import { createClient } from "@supabase/supabase-js";

const url = Deno.env.get("SUPABASE_URL")!;
const publishableKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")["default"] as string | undefined;
const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"] as string | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!publishableKey || !secretKey) return json({ error: "not_configured" }, 500);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not_authenticated" }, 401);

  // Client lié à la session de l'utilisateur : la RLS s'applique.
  const asUser = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "not_authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "SUPPRIMER") return json({ error: "confirmation_required" }, 400);

  const { error: prepErr } = await asUser.rpc("prepare_account_deletion");
  if (prepErr) return json({ error: "prepare_failed" }, 500);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: files } = await admin.from("attachments").select("storage_path").eq("owner_id", user.id);
  const paths = (files ?? []).map((f: { storage_path: string }) => f.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from("attachments").remove(paths.slice(i, i + 100));
  }

  for (;;) {
    const { data: objects } = await admin.storage.from("fichiers").list(user.id, { limit: 100 });
    if (!objects?.length) break;
    const { error: rmErr } = await admin.storage.from("fichiers").remove(objects.map((o: { name: string }) => `${user.id}/${o.name}`));
    if (rmErr) return json({ error: "delete_failed" }, 500);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true });
});
