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
  lumineux: { label: "Lumineux", color: "#C9A86A" },
  serein: { label: "Serein", color: "#8E9A8A" },
  tendre: { label: "Tendre", color: "#B39A8C" },
  pensif: { label: "Pensif", color: "#7D8794" },
  fatigue: { label: "Fatigué", color: "#B5AEA4" },
  tendu: { label: "Tendu", color: "#B4654A" },
  melancolique: { label: "Mélancolique", color: "#5E6A7D" },
};

/**
 * Styles de couverture, repris des collections du design system :
 * chaque style décide où et comment le titre du journal s'affiche.
 */
export const COVER_STYLES = ["minimaliste", "editorial", "vintage", "classique", "moderne", "artistique", "abstrait"] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

/**
 * Couvertures disponibles au lancement. Les identifiants sont stockés en base :
 * ne jamais en renommer un, seulement en ajouter. `from`/`to` restent pour les
 * anciens écrans (dégradé) ; `bg`/`fg` sont les couleurs des maquettes.
 */
export const COVERS = [
  { id: "minimaliste-ivoire", label: "Ivoire", style: "minimaliste", bg: "#E8E1D6", fg: "#151515", from: "#E8E1D6", to: "#E8E1D6" },
  { id: "nuit-encre", label: "Encre", style: "classique", bg: "#1F2A3A", fg: "#E8E1D6", from: "#1F2A3A", to: "#1F2A3A" },
  { id: "nature-sauge", label: "Sauge", style: "editorial", bg: "#3F4A3C", fg: "#F5F3EE", from: "#3F4A3C", to: "#3F4A3C" },
  { id: "vintage-bordeaux", label: "Bordeaux", style: "vintage", bg: "#6B2E2A", fg: "#E8E1D6", from: "#6B2E2A", to: "#6B2E2A" },
  { id: "voyage-terracotta", label: "Terracotta", style: "moderne", bg: "#B4654A", fg: "#F5F3EE", from: "#B4654A", to: "#B4654A" },
  { id: "reve-brume", label: "Brume", style: "artistique", bg: "#93A3B2", fg: "#151515", from: "#93A3B2", to: "#93A3B2" },
  { id: "lumiere-miel", label: "Miel", style: "abstrait", bg: "#C79A4B", fg: "#151515", from: "#C79A4B", to: "#C79A4B" },
  { id: "pierre-galet", label: "Galet", style: "minimaliste", bg: "#65615B", fg: "#F5F3EE", from: "#65615B", to: "#65615B" },
] as const satisfies readonly { id: string; label: string; style: CoverStyle; bg: string; fg: string; from: string; to: string }[];
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

export const entryUpdateSchema = entrySchema.extend({ entryId: z.uuid() });
export type EntryUpdateInput = z.infer<typeof entryUpdateSchema>;
