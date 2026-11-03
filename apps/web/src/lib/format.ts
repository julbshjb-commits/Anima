/** Petites mises en forme de dates, en français et en heure locale. */
const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « à l'instant », « il y a 2 h », « hier », « il y a 4 jours », sinon « 12 oct. ». */
export function relativeTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const minutes = Math.round((now.getTime() - d.getTime()) / 60000);
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return `il y a ${Math.round(minutes / 60)} h`;
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  return short.format(d);
}

export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Lit « AAAA-MM » (paramètre ?mois=) ; sinon le mois en cours. */
export function parseMonth(raw: unknown): { y: number; m: number } {
  const now = new Date();
  if (typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number) as [number, number];
    if (m >= 1 && m <= 12) return { y, m: m - 1 };
  }
  return { y: now.getFullYear(), m: now.getMonth() };
}

/** Phrase d'état en haut de la page d'écriture : qui lira l'entrée. */
export function visibilityOf(kind: string, others: string) {
  if (kind === "intime") return "Visible par toi seul";
  if (others === "toi seul pour l'instant") return "Visible par les personnes que tu inviteras";
  return `Visible par ${others.replace(/ et toi$/, "")} dès que tu publies`;
}
