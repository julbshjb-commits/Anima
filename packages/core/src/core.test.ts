import { describe, expect, it } from "vitest";
import {
  createJournalSchema, entrySchema, formatInviteCode, isValidInviteCode,
  monthGrid, normalizeInviteCode, toIsoDate,
} from "./index";
import { checkUpload, filePath, folderNameSchema, formatBytes } from "./index";
import { notebookSchema, parseTags, postSchema, progressPercent, quoteSchema, seanceToText, workSchema } from "./index";

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

describe("notes", () => {
  it("lit les tags saisis librement", () => {
    expect(parseTags("#partiels, schéma  #à-revoir #Partiels")).toEqual(["partiels", "schéma", "à-revoir"]);
    expect(parseTags("")).toEqual([]);
  });
  it("valide un carnet et refuse une couverture inconnue", () => {
    expect(notebookSchema.parse({ title: " Droit ", kind: "cours", subtitle: "" })).toMatchObject({ title: "Droit", subtitle: null, cover: "nature-sauge" });
    expect(notebookSchema.safeParse({ title: "X", cover: "pirate" }).success).toBe(false);
  });
  it("met une séance en texte", () => {
    expect(seanceToText([{ kind: "texte", content: "I. A priori", author: "Nassim" }, { kind: "question", content: "QPC ?", author: "Inès" }])).toBe(
      "I. A priori\n— Nassim\n\nQuestion (Inès) : QPC ?",
    );
  });
});

describe("cercles", () => {
  it("garde seulement les champs du type choisi", () => {
    const p = postSchema.parse({ kind: "evenement", body: "Qui vient ?", eventTitle: "Strasbourg", eventDay: "2026-12-12", quoteText: "ignorée" });
    expect(p).toMatchObject({ body: "Qui vient ?", event_title: "Strasbourg", event_day: "2026-12-12", quote_text: null });
  });
  it("refuse une publication vide ou un événement sans jour", () => {
    expect(postSchema.safeParse({ kind: "mot", body: "  " }).success).toBe(false);
    expect(postSchema.safeParse({ kind: "evenement", eventTitle: "Fête" }).success).toBe(false);
    expect(postSchema.safeParse({ kind: "citation", quoteText: "Chaque homme…", quoteSource: "Montaigne" }).success).toBe(true);
  });
});

describe("bibliothèque", () => {
  it("valide une œuvre saisie dans un formulaire", () => {
    const w = workSchema.parse({ title: "Les Années", creator: "Annie Ernaux", progress: "158", progress_total: "254", rating: "", url: "" });
    expect(w).toMatchObject({ kind: "livre", progress: 158, progress_total: 254, rating: null, url: null, creator: "Annie Ernaux" });
    expect(workSchema.safeParse({ title: "X", progress: "300", progress_total: "254" }).success).toBe(false);
    expect(workSchema.safeParse({ title: "X", url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("retire les guillemets d'une citation collée", () => {
    expect(quoteSchema.parse({ text: "« On ne voit bien qu'avec le cœur. »", source: "" })).toEqual({ text: "On ne voit bien qu'avec le cœur.", source: null });
  });
  it("calcule l'avancement", () => {
    expect(progressPercent(158, 254)).toBe(62);
    expect(progressPercent(10, null)).toBeNull();
  });
});

describe("fichiers", () => {
  it("affiche les tailles en unités françaises", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(86 * 1024)).toBe("86 Ko");
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2,4 Mo");
    expect(formatBytes(3.2 * 1024 ** 3)).toBe("3,2 Go");
    expect(formatBytes(1024 * 1024)).toBe("1 Mo");
  });
  it("range le fichier dans le dossier de sa propriétaire", () => {
    expect(filePath("u1", "f1", "application/pdf")).toBe("u1/f1.pdf");
  });
  it("refuse les types inconnus et les fichiers trop gros", () => {
    expect(checkUpload({ name: "a.exe", size: 10, type: "application/x-msdownload" })).toMatch(/pas un type accepté/);
    expect(checkUpload({ name: "a.pdf", size: 26 * 1024 * 1024, type: "application/pdf" })).toMatch(/25 Mo/);
    expect(checkUpload({ name: "a.pdf", size: 10, type: "application/pdf" })).toBeNull();
  });
  it("nettoie les noms de dossier", () => {
    expect(folderNameSchema.parse("  Cours / L2 ")).toBe("Cours L2");
    expect(folderNameSchema.safeParse("   ").success).toBe(false);
  });
});
