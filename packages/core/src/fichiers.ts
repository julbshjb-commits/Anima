/**
 * Domaine « Fichiers » partagé entre le web et le mobile : types acceptés
 * (mêmes limites que le bucket « fichiers », migration 10), tailles lisibles,
 * chemins de stockage et noms de dossiers.
 */
import { z } from "zod";

type FileType = { ext: string; badge: string; color: string; image?: boolean };

const WORD = { badge: "DOC", color: "#3B4A3F" };
const SHEET = { badge: "XLS", color: "#4E6B4A" };
const SLIDES = { badge: "PPT", color: "#9A5B3C" };

export const FILE_TYPES: Record<string, FileType> = {
  "application/pdf": { ext: "pdf", badge: "PDF", color: "#6E2C2C" },
  "image/jpeg": { ext: "jpg", badge: "JPG", color: "#8DA0B3", image: true },
  "image/png": { ext: "png", badge: "PNG", color: "#8DA0B3", image: true },
  "image/webp": { ext: "webp", badge: "IMG", color: "#8DA0B3", image: true },
  "image/heic": { ext: "heic", badge: "HEIC", color: "#8DA0B3", image: true },
  "image/gif": { ext: "gif", badge: "GIF", color: "#8DA0B3", image: true },
  "text/plain": { ext: "txt", badge: "TXT", color: "#65615B" },
  "text/markdown": { ext: "md", badge: "MD", color: "#65615B" },
  "text/csv": { ext: "csv", badge: "CSV", color: SHEET.color },
  "application/msword": { ext: "doc", ...WORD },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", ...WORD },
  "application/vnd.oasis.opendocument.text": { ext: "odt", ...WORD },
  "application/vnd.ms-excel": { ext: "xls", ...SHEET },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", ...SHEET },
  "application/vnd.oasis.opendocument.spreadsheet": { ext: "ods", ...SHEET },
  "application/vnd.ms-powerpoint": { ext: "ppt", ...SLIDES },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", ...SLIDES },
  "application/vnd.oasis.opendocument.presentation": { ext: "odp", ...SLIDES },
};

/** Valeur de l'attribut accept d'un champ fichier. */
export const FILE_ACCEPT = Object.keys(FILE_TYPES).join(",");
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function fileType(mime: string): FileType {
  return FILE_TYPES[mime] ?? { ext: "bin", badge: "FICHIER", color: "#65615B" };
}

export function isImage(mime: string): boolean {
  return Boolean(FILE_TYPES[mime]?.image);
}

/** « 2,4 Mo », « 86 Ko », « 3,2 Go » (unités françaises, base 1024). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const s = v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
  return `${s.replace(".", ",")} ${units[i]}`;
}

/** Chemin imposé par la RLS du stockage : {propriétaire}/{fichier}.{ext}. */
export function filePath(ownerId: string, fileId: string, mime: string): string {
  return `${ownerId}/${fileId}.${fileType(mime).ext}`;
}

/** Vérifie un fichier avant l'envoi ; renvoie un message d'erreur ou null. */
export function checkUpload(file: { name: string; size: number; type: string }): string | null {
  if (!FILE_TYPES[file.type]) return `« ${file.name} » n'est pas un type accepté (PDF, images, documents Office ou LibreOffice, texte).`;
  if (file.size > MAX_FILE_BYTES) return `« ${file.name} » dépasse 25 Mo.`;
  if (file.size === 0) return `« ${file.name} » est vide.`;
  return null;
}

const name = (max: number, empty: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\\/\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, empty).max(max, `${max} caractères maximum.`));

export const folderNameSchema = name(120, "Donne un nom au dossier.");
export const fileNameSchema = name(200, "Le nom ne peut pas être vide.");
