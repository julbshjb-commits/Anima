"use server";
import { createClient } from "@/lib/supabase/server";
import { Q } from "./questions";

export type SondageState = { status: "idle" | "ok" | "error"; message?: string };

const one = (fd: FormData, k: keyof typeof Q) => {
  const v = String(fd.get(k) ?? "");
  return (Q[k] as readonly string[]).includes(v) ? v : null;
};
const note = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

export async function envoyerSondage(_: SondageState, fd: FormData): Promise<SondageState> {
  const methodes = fd.getAll("methodes").map(String).filter((m) => (Q.methodes as readonly string[]).includes(m));
  const r = {
    filiere: one(fd, "filiere"),
    debut: one(fd, "debut"),
    oubli: one(fd, "oubli"),
    usage_cartes: one(fd, "usage_cartes"),
    frein: one(fd, "frein"),
    prix: one(fd, "prix"),
    utilite: note(fd, "utilite"),
    promo: note(fd, "promo"),
  };
  if (Object.values(r).some((v) => v === null) || methodes.length === 0)
    return { status: "error", message: "Il manque une réponse : toutes les questions sauf la dernière sont obligatoires." };
  const email = String(fd.get("email") ?? "").trim().slice(0, 200);
  const accord = fd.get("accord_email") === "on";
  if (email && (!email.includes("@") || !accord))
    return { status: "error", message: "Pour être prévenu au lancement, coche la case d'accord sous ton e-mail." };
  const supabase = await createClient();
  // Table récente, pas encore dans les types générés.
  const { error } = await (supabase as unknown as { from: (t: string) => { insert: (v: object) => Promise<{ error: unknown }> } })
    .from("sondage_reponses")
    .insert({ ...r, methodes, enerve: String(fd.get("enerve") ?? "").slice(0, 1000), email: email || null, accord_email: Boolean(email) && accord });
  if (error) return { status: "error", message: "L'envoi n'a pas marché. Réessaie dans un instant." };
  return { status: "ok" };
}
