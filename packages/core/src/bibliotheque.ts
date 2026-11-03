/**
 * Domaine « Bibliothèque » partagé entre le web et le mobile : œuvres
 * (livres, films, séries, podcasts, articles), citations, objectif annuel.
 */
import { z } from "zod";
import { COVERS } from "./journaux";

export const WORK_KINDS = {
  livre: { label: "Livre", plural: "Livres", unit: "page" },
  film: { label: "Film", plural: "Films", unit: "minute" },
  serie: { label: "Série", plural: "Séries", unit: "épisode" },
  podcast: { label: "Podcast", plural: "Podcasts", unit: "épisode" },
  article: { label: "Article ou lien", plural: "Articles et liens", unit: "" },
} as const;
export const WORK_STATUS = { "a-lire": "À découvrir", "en-cours": "En cours", termine: "Terminé" } as const;

const coverIds = COVERS.map((c) => c.id) as [string, ...string[]];
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null);
const int = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(100000).nullable()).default(null);
const day = z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").nullable()).default(null);

export const workSchema = z
  .object({
    kind: z.enum(["livre", "film", "serie", "podcast", "article"]).default("livre"),
    title: z.string().trim().min(1, "Donne un titre.").max(200, "200 caractères maximum."),
    creator: opt(120),
    cover: z.enum(coverIds).default("vintage-bordeaux"),
    status: z.enum(["a-lire", "en-cours", "termine"]).default("a-lire"),
    progress: int,
    progress_total: int,
    rating: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(5).nullable()).default(null),
    started_on: day,
    finished_on: day,
    url: z.preprocess((v) => (v === "" ? null : v), z.url({ protocol: /^https?$/, error: "Lien invalide (http ou https)." }).max(2000).nullable()).default(null),
    note: opt(5000),
  })
  .refine((w) => w.progress == null || w.progress_total == null || w.progress <= w.progress_total, {
    message: "Tu ne peux pas en être plus loin que la fin.",
    path: ["progress"],
  })
  .refine((w) => !w.progress_total || w.progress_total > 0, { message: "Le total doit être positif.", path: ["progress_total"] })
  .refine((w) => !w.finished_on || !w.started_on || w.finished_on >= w.started_on, { message: "La fin doit être après le début.", path: ["finished_on"] });
export type WorkInput = z.infer<typeof workSchema>;

export const quoteSchema = z.object({
  text: z
    .string()
    .trim()
    .transform((t) => t.replace(/^[«"“]\s*|\s*[»"”]$/g, ""))
    .pipe(z.string().min(1, "Écris la citation.").max(2000, "2 000 caractères maximum.")),
  source: opt(200),
});

/** Pourcentage lu, ou null si on ne connaît pas le total. */
export function progressPercent(progress: number | null, total: number | null): number | null {
  if (progress == null || !total) return null;
  return Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
}
