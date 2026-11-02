"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LinkState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const schema = z.object({
  email: z.email("Cette adresse e-mail ne semble pas valide."),
  suite: z.string().startsWith("/").optional().catch(undefined),
});

/** Envoie un lien de connexion par e-mail (pas de mot de passe). */
export async function sendMagicLink(_prev: LinkState, form: FormData): Promise<LinkState> {
  const parsed = schema.safeParse({ email: form.get("email"), suite: form.get("suite") || undefined });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const next = parsed.data.suite && !parsed.data.suite.startsWith("//") ? parsed.data.suite : "/journaux";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?suite=${encodeURIComponent(next)}` },
  });
  if (error) {
    return { status: "error", message: "L'envoi a échoué. Réessaie dans une minute." };
  }
  return { status: "sent", email: parsed.data.email };
}
