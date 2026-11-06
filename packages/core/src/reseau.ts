/**
 * Le réseau public d'Anima, partagé entre le web et le mobile : profil
 * public (pseudo), publications, abonnements, j'aime, commentaires,
 * signalements. Les règles d'accès vivent en base (migration 14).
 */
import { z } from "zod";
import { MOODS } from "./journaux";

export const HANDLE_RE = /^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$/;

/** Pseudos que personne ne peut prendre (doivent rester alignés avec la base). */
export const RESERVED_HANDLES = [
  "anima", "admin", "administrateur", "moderation", "moderateur", "support", "aide", "help",
  "equipe", "team", "officiel", "official", "contact", "reglages", "compte", "connexion",
  "decouvrir", "fil", "profil", "publier", "notifications", "recherche", "root", "system",
] as const;

/** Nettoie une saisie de pseudo : minuscules, sans @ ni espaces, accents retirés. */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Propose un pseudo à partir d'un prénom (« Zoé Martin » → « zoe_martin »). */
export function suggestHandle(name: string): string {
  const base = normalizeHandle(name).replace(/[^a-z0-9_.]/g, "").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
  return (base.length >= 3 ? base : `${base}_anima`).slice(0, 24);
}

export const handleSchema = z
  .string()
  .transform(normalizeHandle)
  .refine((h) => h.length >= 3, "3 caractères minimum.")
  .refine((h) => h.length <= 24, "24 caractères maximum.")
  .refine((h) => HANDLE_RE.test(h) && !h.includes(".."), "Lettres, chiffres, point et _ seulement (pas de point au début ni à la fin).")
  .refine((h) => !(RESERVED_HANDLES as readonly string[]).includes(h), "Ce pseudo est réservé.");

export const publicProfileSchema = z.object({
  handle: handleSchema,
  name: z.string().trim().min(1, "Écris le nom à afficher.").max(40, "40 caractères maximum."),
  bio: z.string().trim().max(160, "160 caractères maximum.").default(""),
  isPrivate: z.boolean().default(false),
});

export const PUBLIC_POST_SOURCES = ["libre", "journal", "note", "citation"] as const;
export type PublicPostSource = (typeof PUBLIC_POST_SOURCES)[number];

export const publicPostSchema = z
  .object({
    body: z.string().trim().max(2000, "2 000 caractères maximum.").default(""),
    mood: z.enum(MOODS).nullable().optional().default(null),
    source: z.enum(PUBLIC_POST_SOURCES).default("libre"),
    quoteBy: z
      .string()
      .trim()
      .max(120, "120 caractères maximum.")
      .transform((v) => v || null)
      .nullable()
      .optional()
      .default(null),
    hasPhoto: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (!p.body && !p.hasPhoto) ctx.addIssue({ code: "custom", message: "Écris quelque chose ou ajoute une photo.", path: ["body"] });
    if (p.source === "citation" && !p.body) ctx.addIssue({ code: "custom", message: "Écris la citation.", path: ["body"] });
  });

export const publicCommentSchema = z.string().trim().min(1, "Écris ton commentaire.").max(500, "500 caractères maximum.");

export const REPORT_REASONS = {
  spam: "Spam ou arnaque",
  harcelement: "Harcèlement",
  haine: "Propos haineux",
  nudite: "Nudité ou contenu sexuel",
  violence: "Violence ou menace",
  mineur: "Met en danger un mineur",
  autre: "Autre chose",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** Mots qui bloquent la publication (filtre de base ; la modération fait le reste). */
const BLOCKED_WORDS = ["nique ta", "sale pute", "pd de", "bougnoule", "youpin", "negro de", "kill yourself", "suicide-toi", "va te pendre"];

export function containsBlockedWords(text: string): boolean {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return BLOCKED_WORDS.some((w) => t.includes(w));
}

/** Chemin d'une image du réseau dans le bucket « social ». */
export function socialPath(userId: string, kind: "avatar" | "post", mime: string, id: string): string {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `${userId}/${kind}-${id}.${ext}`;
}

export const SOCIAL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_SOCIAL_IMAGE_BYTES = 10 * 1024 * 1024;

/** 1 234 → « 1,2 k » */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(".", ",").replace(",0", "")} k`;
  return `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} M`;
}
