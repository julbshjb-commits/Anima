/**
 * Domaine « Notes » partagé entre le web et le mobile : carnets, notes,
 * tags, et passages des séances de cours.
 */
import { z } from "zod";
import { COVERS } from "./journaux";

const coverIds = COVERS.map((c) => c.id) as [string, ...string[]];

export const notebookSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom au carnet.").max(80, "80 caractères maximum."),
  kind: z.enum(["perso", "cours"]).default("perso"),
  subtitle: z
    .string()
    .trim()
    .max(80, "80 caractères maximum.")
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null),
  cover: z.enum(coverIds).default("nature-sauge"),
});
export type NotebookInput = z.infer<typeof notebookSchema>;

/** « #partiels, schéma  à-revoir » → ["partiels", "schéma", "à-revoir"] */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,;]+/)) {
    const t = raw
      .replace(/^#+/, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, 30);
    if (t) seen.add(t);
    if (seen.size >= 20) break;
  }
  return [...seen];
}

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Donne un titre à la note.").max(120, "120 caractères maximum."),
  body: z.string().max(100000, "Note trop longue (100 000 caractères maximum).").default(""),
  tags: z.string().max(600).default("").transform(parseTags),
});

export const seanceSchema = z.object({
  title: z.string().trim().min(1, "Donne un titre à la séance.").max(120, "120 caractères maximum."),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
});

export const blockSchema = z.object({
  kind: z.enum(["texte", "question"]).default("texte"),
  content: z.string().trim().min(1, "Écris quelque chose.").max(20000, "20 000 caractères maximum."),
});

/** Texte brut d'une séance, pour la copier dans un carnet perso ou la fiche de révision. */
export function seanceToText(blocks: { kind: string; content: string; author: string }[]): string {
  return blocks
    .map((b) => (b.kind === "question" ? `Question (${b.author}) : ${b.content}` : `${b.content}\n— ${b.author}`))
    .join("\n\n");
}
