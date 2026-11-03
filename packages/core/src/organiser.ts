/**
 * Domaine « M'organiser » partagé entre le web et le mobile :
 * validation des formulaires et saisie rapide en français.
 */
import { z } from "zod";
import { MOODS } from "./journaux";
import { toIsoDate } from "./dates";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null);

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide.");

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Écris la tâche.").max(200, "200 caractères maximum."),
    projectId: z.uuid().nullable().optional().default(null),
    dueDate: isoDay.nullable().optional().default(null),
    dueTime: hhmm.nullable().optional().default(null),
    durationMin: z.coerce.number().int().min(1).max(1440).nullable().optional().default(null),
    note: optionalText(2000),
  })
  .refine((t) => !t.dueTime || t.dueDate, { message: "Choisis un jour pour cette heure.", path: ["dueTime"] });
export type TaskInput = z.infer<typeof taskSchema>;

export const projectSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom au projet.").max(80, "80 caractères maximum."),
  color: z.enum(MOODS).default("pensif"),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Donne un titre au rendez-vous.").max(120, "120 caractères maximum."),
    place: optionalText(120),
    color: z.enum(MOODS).default("pensif"),
    day: isoDay,
    start: hhmm,
    end: hhmm.nullable().optional().default(null),
  })
  .refine((e) => !e.end || e.end > e.start, { message: "La fin doit être après le début.", path: ["end"] });
export type EventInput = z.infer<typeof eventSchema>;

export const ritualSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom au rituel.").max(80, "80 caractères maximum."),
});

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Saisie rapide : « appeler maman demain 18 h » → titre « Appeler maman »,
 * jour = demain, heure = 18:00. Reconnaît aujourd'hui, ce soir, demain,
 * après-demain, un jour de la semaine (le prochain), et 18h, 18 h, 18h30, 18:30.
 */
export function parseQuickTask(input: string, now = new Date()): { title: string; dueDate: string | null; dueTime: string | null } {
  let text = ` ${input.trim().replace(/\s+/g, " ")} `;
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  const day = (offset: number) => toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));

  const time = text.match(/\s(?:à\s)?([01]?\d|2[0-3])\s?(?:h|:)\s?([0-5]\d)?(?=\s)/i);
  if (time) {
    dueTime = `${time[1]!.padStart(2, "0")}:${time[2] ?? "00"}`;
    text = text.replace(time[0], " ");
  }

  const rules: [RegExp, () => string, string?][] = [
    [/\saprès-demain(?=\s)/i, () => day(2)],
    [/\sdemain(?=\s)/i, () => day(1)],
    [/\saujourd['’]hui(?=\s)/i, () => day(0)],
    [/\sce soir(?=\s)/i, () => day(0), "19:00"],
  ];
  for (const [re, date, defaultTime] of rules) {
    if (re.test(text)) {
      dueDate = date();
      if (defaultTime && !dueTime) dueTime = defaultTime;
      text = text.replace(re, " ");
      break;
    }
  }
  if (!dueDate) {
    const wd = text.match(new RegExp(`\\s(${WEEKDAYS.join("|")})(?=\\s)`, "i"));
    if (wd) {
      const target = WEEKDAYS.indexOf(wd[1]!.toLowerCase());
      const diff = (target - now.getDay() + 7) % 7 || 7;
      dueDate = day(diff);
      text = text.replace(wd[0], " ");
    }
  }
  if (dueTime && !dueDate) dueDate = day(0);

  const title = text.trim().replace(/\s+/g, " ");
  return { title: title.charAt(0).toLocaleUpperCase("fr-FR") + title.slice(1), dueDate, dueTime };
}
