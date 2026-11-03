/** Photos des entrées : mêmes limites que le bucket « attachments » (migration 2). */
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 4;

/** Chemin imposé par la RLS du stockage : {journal}/{entrée}/{fichier}. */
export function photoPath(journalId: string, entryId: string, fileId: string, mimeType: string): string {
  return `${journalId}/${entryId}/${fileId}.${PHOTO_TYPES[mimeType] ?? "jpg"}`;
}
