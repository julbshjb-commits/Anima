/**
 * Domaine « journaux » partagé entre le web et le mobile.
 * Les valeurs doivent rester identiques aux enums Postgres
 * (supabase/migrations/20261102000001_journaux.sql).
 */
import { z } from "zod";

export const JOURNAL_KINDS = [
  "intime", "couple", "amis", "famille", "colocation",
  "voyage", "gratitude", "reves", "lecture", "projet",
] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

export const JOURNAL_KIND_LABELS: Record<JournalKind, string> = {
  intime: "Journal intime",
  couple: "Couple",
  amis: "Amis",
  famille: "Famille",
  colocation: "Colocation",
  voyage: "Voyage",
  gratitude: "Gratitude",
  reves: "Rêves",
  lecture: "Lecture",
  projet: "Projet",
};

/** Types qu'on peut créer depuis l'interface (l'intime est créé une seule fois, à part). */
export const SHARED_JOURNAL_KINDS = JOURNAL_KINDS.filter((k) => k !== "intime");

export const JOURNAL_ROLES = ["owner", "editor", "reader"] as const;
export type JournalRole = (typeof JOURNAL_ROLES)[number];

export const MOODS = [
  "lumineux", "serein", "tendre", "pensif", "fatigue", "tendu", "melancolique",
] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_META: Record<Mood, { label: string; color: string }> = {
  lumineux: { label: "Lumineux", color: "#D9B95C" },
  serein: { label: "Serein", color: "#9DB09A" },
  tendre: { label: "Tendre", color: "#D6A9A0" },
  pensif: { label: "Pensif", color: "#8C9BB0" },
  fatigue: { label: "Fatigué", color: "#B5AEA4" },
  tendu: { label: "Tendu", color: "#B4654A" },
  melancolique: { label: "Mélancolique", color: "#5E6A7D" },
};

/** Couvertures disponibles au lancement (une par collection). */
export const COVERS = [
  { id: "minimaliste-ivoire", label: "Ivoire", from: "#E8E1D6", to: "#C8B99F" },
  { id: "nature-sauge", label: "Sauge", from: "#9DB09A", to: "#5F7360" },
  { id: "nuit-encre", label: "Encre", from: "#292826", to: "#151515" },
  { id: "voyage-terracotta", label: "Terracotta", from: "#D6A9A0", to: "#B4654A" },
  { id: "reve-brume", label: "Brume", from: "#8C9BB0", to: "#5E6A7D" },
  { id: "lumiere-miel", label: "Miel", from: "#E9D49A", to: "#D9B95C" },
  { id: "pierre-galet", label: "Galet", from: "#B5AEA4", to: "#65615B" },
] as const;
export type CoverId = (typeof COVERS)[number]["id"];
export const COVER_IDS = COVERS.map((c) => c.id) as [CoverId, ...CoverId[]];

export function coverOf(id: string | null | undefined) {
  return COVERS.find((c) => c.id === id) ?? COVERS[0];
}

export const createJournalSchema = z.object({
  title: z.string().trim().min(1, "Donne un titre au journal.").max(80, "80 caractères maximum."),
  kind: z.enum(SHARED_JOURNAL_KINDS as [JournalKind, ...JournalKind[]]),
  cover: z.enum(COVER_IDS),
});
export type CreateJournalInput = z.infer<typeof createJournalSchema>;

/** Date locale au format AAAA-MM-JJ (la colonne entry_date est un `date`). */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const entrySchema = z.object({
  journalId: z.uuid(),
  entryDate: isoDate,
  title: z.string().trim().max(120, "120 caractères maximum.").optional().default(""),
  contentText: z.string().trim().min(1, "Écris au moins quelques mots.").max(50_000),
  mood: z.enum(MOODS).nullable().optional().default(null),
});
export type EntryInput = z.infer<typeof entrySchema>;
