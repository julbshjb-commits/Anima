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

/** Fuseau d'Anima tant que le profil ne stocke pas celui de chacun. */
export const APP_TIME_ZONE = "Europe/Paris";

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - utcMs;
}

/** « 2026-11-03 » + « 14:00 » à Paris → instant ISO (UTC), heure d'été comprise. */
export function zonedToIso(day: string, time: string, timeZone = APP_TIME_ZONE): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let utc = naive - tzOffsetMs(naive, timeZone);
  utc = naive - tzOffsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

/** Jour (AAAA-MM-JJ) et heure (HH:MM) d'un instant, vus depuis Paris. */
export function zonedParts(iso: string, timeZone = APP_TIME_ZONE): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso));
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { day: `${v("year")}-${v("month")}-${v("day")}`, time: `${v("hour")}:${v("minute")}` };
}

/** Aujourd'hui à Paris (le serveur, lui, tourne en UTC). */
export function todayIn(timeZone = APP_TIME_ZONE, now = new Date()): string {
  return zonedParts(now.toISOString(), timeZone).day;
}
