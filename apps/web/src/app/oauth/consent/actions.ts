"use server";
import { redirect } from "next/navigation";
import { aiSpacesSchema } from "@anima/core";
import { requireUser } from "@/lib/auth";
import { saveAiSpaces } from "@/lib/ia";

export type ConsentState = { error?: string };

/** Autoriser ou refuser l'appli. Les espaces cochés sont enregistrés avant l'accord. */
export async function decide(_: ConsentState, form: FormData): Promise<ConsentState> {
  const id = String(form.get("authorizationId") ?? "");
  if (!/^[\w-]{8,200}$/.test(id)) return { error: "Demande d'autorisation invalide." };
  const { supabase, user } = await requireUser();

  if (form.get("decision") !== "approve") {
    const { data, error } = await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
    if (error || !data) return { error: "La demande a expiré. Recommence depuis l'appli." };
    redirect(data.redirect_url);
  }

  const spaces = aiSpacesSchema.safeParse(form.getAll("spaces"));
  if (!spaces.success) return { error: "Choix d'espaces invalide." };
  if (spaces.data.length === 0) return { error: "Coche au moins un espace, ou refuse." };
  const saved = await saveAiSpaces(supabase, user.id, spaces.data);
  if (saved.error) return { error: "Tes choix n'ont pas pu être enregistrés. Réessaie." };

  const { data, error } = await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data) return { error: "La demande a expiré. Recommence depuis l'appli." };
  redirect(data.redirect_url);
}
