/** Utilitaires de dates en heure locale (jamais toISOString, qui passe en UTC). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Grille d'un mois commençant le lundi : 35 ou 42 cases, null hors du mois. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toIsoDate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

const longFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
export function formatLongDate(s: string): string {
  const out = longFmt.format(parseIsoDate(s));
  return out.charAt(0).toUpperCase() + out.slice(1);
}
