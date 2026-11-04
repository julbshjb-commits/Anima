import "server-only";
import { AI_SPACES, type AiSpace } from "@anima/core";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Espaces que la personne a ouverts aux assistants IA (aucun par défaut). */
export async function getAiSpaces(supabase: Client, userId: string): Promise<AiSpace[]> {
  const { data } = await supabase.from("ai_access").select("spaces").eq("user_id", userId).maybeSingle();
  return (data?.spaces ?? []).filter((s): s is AiSpace => (AI_SPACES as readonly string[]).includes(s));
}

export async function saveAiSpaces(supabase: Client, userId: string, spaces: AiSpace[]) {
  return supabase.from("ai_access").upsert({ user_id: userId, spaces, updated_at: new Date().toISOString() } as never);
}
