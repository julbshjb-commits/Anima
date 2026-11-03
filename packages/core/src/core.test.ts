import { describe, expect, it } from "vitest";
import {
  createJournalSchema, entrySchema, formatInviteCode, isValidInviteCode,
  monthGrid, normalizeInviteCode, toIsoDate,
} from "./index";

describe("codes d'invitation", () => {
  it("normalise la saisie", () => {
    expect(normalizeInviteCode(" k7m-q2p ")).toBe("K7MQ2P");
  });
  it("refuse les caractères ambigus et les mauvaises longueurs", () => {
    expect(isValidInviteCode("K7MQ2P")).toBe(true);
    expect(isValidInviteCode("K7MQ0P")).toBe(false);
    expect(isValidInviteCode("K7MQ2")).toBe(false);
  });
  it("formate en deux groupes", () => {
    expect(formatInviteCode("k7mq2p")).toBe("K7M-Q2P");
  });
});

describe("schémas", () => {
  it("refuse de créer un journal intime depuis le formulaire partagé", () => {
    const r = createJournalSchema.safeParse({ title: "Moi", kind: "intime", cover: "nuit-encre" });
    expect(r.success).toBe(false);
  });
  it("accepte une entrée simple", () => {
    const r = entrySchema.parse({
      journalId: "11111111-1111-4111-8111-111111111111",
      entryDate: "2026-11-02",
      contentText: "Une belle journée.",
    });
    expect(r.mood).toBeNull();
  });
});

describe("dates", () => {
  it("garde la date locale", () => {
    expect(toIsoDate(new Date(2026, 0, 18, 23, 30))).toBe("2026-01-18");
  });
  it("commence la grille le lundi", () => {
    const g = monthGrid(2026, 10); // novembre 2026 : le 1er est un dimanche
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(g.length % 7).toBe(0);
  });
});

describe("textToDoc", () => {
  it("découpe en paragraphes sur les lignes vides", async () => {
    const { textToDoc } = await import("./contenu");
    const doc = textToDoc("Bonjour\n\nÀ demain");
    expect(doc.content).toHaveLength(2);
    expect(doc.content[1]?.content[0]?.text).toBe("À demain");
  });
});

describe("photoPath", () => {
  it("range la photo dans le dossier du journal puis de l'entrée", async () => {
    const { photoPath } = await import("./photos");
    expect(photoPath("j1", "e1", "f1", "image/png")).toBe("j1/e1/f1.png");
    expect(photoPath("j1", "e1", "f1", "image/inconnu")).toBe("j1/e1/f1.jpg");
  });
});

describe("organiser", () => {
  // Mardi 3 novembre 2026, 10 h.
  const now = new Date(2026, 10, 3, 10, 0);

  it("comprend « demain 18 h »", async () => {
    const { parseQuickTask } = await import("./organiser");
    expect(parseQuickTask("appeler maman demain 18 h", now)).toEqual({ title: "Appeler maman", dueDate: "2026-11-04", dueTime: "18:00" });
  });

  it("comprend un jour de la semaine et 18h30", async () => {
    const { parseQuickTask } = await import("./organiser");
    expect(parseQuickTask("Réviser l'éco vendredi 18h30", now)).toEqual({ title: "Réviser l'éco", dueDate: "2026-11-06", dueTime: "18:30" });
    // « mardi » un mardi = la semaine prochaine
    expect(parseQuickTask("sport mardi", now).dueDate).toBe("2026-11-10");
  });

  it("laisse une tâche sans date telle quelle", async () => {
    const { parseQuickTask } = await import("./organiser");
    expect(parseQuickTask("racheter de la lessive", now)).toEqual({ title: "Racheter de la lessive", dueDate: null, dueTime: null });
  });

  it("refuse une heure sans jour et une fin avant le début", async () => {
    const { taskSchema, eventSchema } = await import("./organiser");
    expect(taskSchema.safeParse({ title: "x", dueTime: "18:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "Cours", day: "2026-11-03", start: "10:00", end: "09:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "Cours", day: "2026-11-03", start: "09:00", end: "10:30" }).success).toBe(true);
  });
});

describe("fuseau de Paris", () => {
  it("convertit l'heure locale en UTC, été comme hiver", async () => {
    const { zonedToIso, zonedParts } = await import("./dates");
    expect(zonedToIso("2026-11-03", "14:00")).toBe("2026-11-03T13:00:00.000Z");
    expect(zonedToIso("2026-07-01", "14:00")).toBe("2026-07-01T12:00:00.000Z");
    expect(zonedParts("2026-11-03T23:30:00.000Z")).toEqual({ day: "2026-11-04", time: "00:30" });
  });
});
