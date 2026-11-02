/**
 * Codes d'invitation : 6 caractères sans ambiguïté visuelle (pas de 0/O, 1/I/L).
 * Le serveur ne stocke que le hash ; ce module ne fait que normaliser
 * et valider ce que tape l'utilisateur.
 */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;

export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidInviteCode(raw: string): boolean {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_LENGTH) return false;
  return [...code].every((c) => INVITE_ALPHABET.includes(c));
}

/** Affichage lisible : « K7M-Q2P ». */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  return c.length === INVITE_LENGTH ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}
