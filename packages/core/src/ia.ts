/**
 * Connecteur Anima pour les assistants IA (Claude…) : les espaces qu'une
 * appli tierce peut voir, choisis par la personne. Rien n'est ouvert par
 * défaut ; le journal intime est un choix à part.
 */
import { z } from "zod";

export const AI_SPACES = ["organiser", "notes", "bibliotheque", "journaux", "cercles", "fichiers", "intime"] as const;
export type AiSpace = (typeof AI_SPACES)[number];

export const AI_SPACE_META: Record<AiSpace, { label: string; detail: string }> = {
  organiser: { label: "M'organiser", detail: "Tâches, projets, agenda et rituels." },
  notes: { label: "Notes", detail: "Carnets, notes et notes de cours." },
  bibliotheque: { label: "Bibliothèque", detail: "Œuvres, avancement et citations." },
  journaux: { label: "Journaux partagés", detail: "Les journaux que tu partages, et les entrées de chacun." },
  cercles: { label: "Cercles", detail: "Les publications de tes cercles, écrites aussi par d'autres." },
  fichiers: { label: "Fichiers", detail: "Ton disque : noms des fichiers et dossiers." },
  intime: { label: "Journal intime", detail: "Ton journal le plus personnel. À n'ouvrir que si tu le veux vraiment." },
};

export const aiSpacesSchema = z.array(z.enum(AI_SPACES)).max(AI_SPACES.length).transform((s) => [...new Set(s)]);
