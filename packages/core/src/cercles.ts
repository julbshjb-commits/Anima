/**
 * Domaine « Cercles » partagé entre le web et le mobile : petits groupes
 * privés où l'on partage un mot, un événement ou une citation.
 */
import { z } from "zod";
import { MOODS } from "./journaux";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const circleSchema = z.object({
  name: z.string().trim().min(1, "Donne un nom au cercle.").max(60, "60 caractères maximum."),
  color: z.enum(MOODS).default("serein"),
});

export const POST_KINDS = ["mot", "evenement", "citation"] as const;
export type PostKind = (typeof POST_KINDS)[number];

/** Une publication : un mot, éventuellement accompagné d'un événement ou d'une citation. */
export const postSchema = z
  .object({
    kind: z.enum(POST_KINDS).default("mot"),
    body: z.string().trim().max(5000, "5 000 caractères maximum.").default(""),
    eventTitle: text(120),
    eventDay: isoDay.nullable().optional().default(null),
    eventEndDay: isoDay.nullable().optional().default(null),
    eventTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide.").nullable().optional().default(null),
    eventPlace: text(120),
    quoteText: text(1000),
    quoteSource: text(200),
  })
  .superRefine((p, ctx) => {
    if (p.kind === "evenement") {
      if (!p.eventTitle) ctx.addIssue({ code: "custom", message: "Donne un nom à l'événement.", path: ["eventTitle"] });
      if (!p.eventDay) ctx.addIssue({ code: "custom", message: "Choisis le jour de l'événement.", path: ["eventDay"] });
      if (p.eventEndDay && p.eventDay && p.eventEndDay < p.eventDay)
        ctx.addIssue({ code: "custom", message: "La fin doit être après le début.", path: ["eventEndDay"] });
    } else if (p.kind === "citation") {
      if (!p.quoteText) ctx.addIssue({ code: "custom", message: "Écris la citation.", path: ["quoteText"] });
    } else if (!p.body) ctx.addIssue({ code: "custom", message: "Écris quelque chose à partager.", path: ["body"] });
  })
  .transform((p) => ({
    body: p.body,
    event_title: p.kind === "evenement" ? p.eventTitle : null,
    event_day: p.kind === "evenement" ? p.eventDay : null,
    event_end_day: p.kind === "evenement" ? p.eventEndDay : null,
    event_time: p.kind === "evenement" ? p.eventTime : null,
    event_place: p.kind === "evenement" ? p.eventPlace : null,
    quote_text: p.kind === "citation" ? p.quoteText : null,
    quote_source: p.kind === "citation" ? p.quoteSource : null,
  }));

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Écris ton commentaire.").max(2000, "2 000 caractères maximum."),
});
