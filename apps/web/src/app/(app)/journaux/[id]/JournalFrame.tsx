import Link from "next/link";
import type { ReactNode } from "react";
import { JOURNAL_KIND_LABELS, MOOD_META, MOODS, formatLongDate, monthGrid, toIsoDate, type JournalRole, type Mood } from "@anima/core";
import type { EntryWithPhotos } from "@/lib/data";
import type { Journal } from "@/lib/database.types";
import { MONTHS } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { Avatar } from "@/components/Avatar";
import { IconRetour, IconSuivant } from "@/components/icons";

export type Member = { id: string; display_name: string; role: JournalRole };

type Props = {
  journal: Journal;
  members: Member[];
  userId: string;
  canWrite: boolean;
  /** Mois affiché dans le calendrier (0 = janvier). */
  year: number;
  month: number;
  /** Entrées de ce mois, déjà lues par la page. */
  entries: EntryWithPhotos[];
  /** Jour mis en avant (la page d'écriture) ; sinon aujourd'hui. */
  selected?: string;
  /** Liste des entrées du mois dans la colonne (masquée sur mobile si la page les montre déjà). */
  listOnMobile?: boolean;
  children: ReactNode;
};

const DARK_MOODS: Mood[] = ["pensif", "melancolique", "tendu"];
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/** « Léa et toi », « Léa, Sami et toi », « toi seul pour l'instant ». */
export function membersLabel(members: Member[], userId: string) {
  const others = members.filter((m) => m.id !== userId).map((m) => m.display_name);
  if (!others.length) return "toi seul pour l'instant";
  if (others.length > 3) return `${others.slice(0, 2).join(", ")} et ${others.length - 2} autres`;
  return `${others.join(", ")} et toi`;
}

export function authorName(id: string, members: Member[], userId: string) {
  return id === userId ? "toi" : (members.find((m) => m.id === id)?.display_name ?? "un ancien membre");
}

/**
 * Cadre des écrans d'un journal, d'après la maquette « Éditeur + calendrier » :
 * à gauche le calendrier des humeurs et les entrées du mois, au centre la page,
 * à droite les personnes qui partagent le journal.
 */
export function JournalFrame(props: Props) {
  const { journal, members, userId, children } = props;
  const isIntime = journal.kind === "intime";
  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <aside
        aria-label="Calendrier et entrées du journal"
        className="lg:w-[320px] shrink-0 px-5 pt-5 pb-6 lg:p-6 lg:pb-8 border-b lg:border-b-0 lg:border-r border-trait flex flex-col gap-7 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto"
      >
        <div className="flex items-center gap-2.5">
          <Link href="/journaux" aria-label="Retour aux journaux" className="w-9 h-9 shrink-0 rounded-full border border-noir/12 grid place-items-center hover:bg-lin">
            <IconRetour size={16} />
          </Link>
          <Cover cover={journal.cover} className="w-7 shrink-0" />
          <Link href={`/journaux/${journal.id}`} className="flex flex-col min-w-0">
            <span className="titre text-[22px] leading-[1.1] truncate">{journal.title}</span>
            <span className="text-xs text-doux truncate">
              {isIntime ? "Journal intime · rien qu'à toi" : `${JOURNAL_KIND_LABELS[journal.kind]} · ${membersLabel(members, userId)}`}
            </span>
          </Link>
        </div>
        <Calendar {...props} />
        <EntryIndex {...props} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>

      <aside aria-label="Personnes du journal" className="hidden xl:flex w-[280px] shrink-0 p-6 border-l border-trait flex-col gap-7 sticky top-0 h-dvh">
        <section className="flex flex-col gap-3">
          <h2 className="surtitre">{isIntime ? "Rien qu'à toi" : "Partagé avec"}</h2>
          {isIntime ? (
            <p className="text-xs leading-normal text-doux">
              Personne d'autre ne peut lire ce journal, et il ne peut pas être partagé.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {members
                .filter((m) => m.id !== userId)
                .map((m, i) => (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <Avatar name={m.display_name} index={i + 1} />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{m.display_name}</span>
                      <span className="text-xs text-doux">
                        {m.role === "owner" ? "A créé le journal" : m.role === "editor" ? "Peut écrire et lire" : "Peut lire"}
                      </span>
                    </span>
                  </li>
                ))}
              {members.length <= 1 && <li className="text-sm text-doux">Personne pour l'instant.</li>}
            </ul>
          )}
          <p className="text-xs leading-normal text-doux">Aucune intelligence artificielle ne lit ce journal.</p>
        </section>
        {!isIntime && props.canWrite && (
          <Link
            href={`/journaux/${journal.id}/inviter`}
            className="flex items-center justify-center h-10 rounded-lg border border-dashed border-noir/20 text-[13px] text-doux hover:text-noir hover:border-noir/40"
          >
            Inviter quelqu'un
          </Link>
        )}
      </aside>
    </div>
  );
}

function Calendar({ journal, members, canWrite, year, month, entries, selected }: Props) {
  const grid = monthGrid(year, month);
  const today = toIsoDate(new Date());
  const focus = selected ?? today;
  const byDay = new Map<string, { mood: Mood | null; authors: Set<string> }>();
  for (const e of entries) {
    const d = byDay.get(e.entry_date) ?? { mood: null, authors: new Set<string>() };
    d.mood ??= e.mood;
    d.authors.add(e.author_id);
    byDay.set(e.entry_date, d);
  }
  const shared = members.length > 1;
  const days = new Date(year, month + 1, 0).getDate();
  const prev = month === 0 ? monthKey(year - 1, 11) : monthKey(year, month - 1);
  const next = month === 11 ? monthKey(year + 1, 0) : monthKey(year, month + 1);
  const base = `/journaux/${journal.id}`;
  const used = MOODS.filter((m) => entries.some((e) => e.mood === m));
  const everyoneOnce = [...byDay.values()].some((d) => d.authors.size === members.length);

  return (
    <section aria-label="Calendrier" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="titre text-[22px] first-letter:uppercase">
            {MONTHS[month]} {year}
          </h2>
          <p className="text-xs text-doux">
            {byDay.size} jour{byDay.size > 1 ? "s" : ""} écrit{byDay.size > 1 ? "s" : ""} sur {days}
          </p>
        </div>
        <span className="flex gap-1">
          <Link href={`${base}?mois=${prev}`} aria-label="Mois précédent" className="w-8 h-8 rounded-full grid place-items-center hover:bg-lin">
            <IconRetour size={16} />
          </Link>
          <Link href={`${base}?mois=${next}`} aria-label="Mois suivant" className="w-8 h-8 rounded-full grid place-items-center hover:bg-lin">
            <IconSuivant size={16} />
          </Link>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="text-[11px] text-doux text-center">
            {d}
          </span>
        ))}
        {grid.map((date, i) => {
          if (!date) return <span key={i} />;
          const info = byDay.get(date);
          const n = Number(date.slice(8));
          const isFocus = date === focus;
          const all = shared && info && info.authors.size === members.length;
          const bg = info ? (info.mood ? MOOD_META[info.mood].color : "#E8E1D6") : undefined;
          const fg = info?.mood && DARK_MOODS.includes(info.mood) ? "#F5F3EE" : info ? "#16130F" : undefined;
          const ring = isFocus ? "shadow-[0_0_0_2px_var(--color-casse),0_0_0_3px_var(--color-noir)] font-semibold" : "";
          const cls = `relative aspect-square rounded-md grid place-items-center text-xs ${info ? "font-medium" : "text-doux"} ${ring}`;
          const label = `${formatLongDate(date)}${info ? (info.mood ? `, ${MOOD_META[info.mood].label}` : ", une entrée") : ", pas d'entrée"}`;
          const dot = all && <span className="absolute bottom-[3px] w-1 h-1 rounded-full" style={{ background: fg ?? "currentColor" }} />;
          if (info)
            return (
              <Link key={date} href={`${base}?mois=${date.slice(0, 7)}#${date}`} aria-label={label} className={`${cls} hover:opacity-85`} style={{ background: bg, color: fg }}>
                {n}
                {dot}
              </Link>
            );
          if (canWrite && date <= today)
            return (
              <Link key={date} href={`${base}/ecrire?date=${date}`} aria-label={`${label} : écrire`} className={`${cls} hover:bg-lin`}>
                {n}
              </Link>
            );
          return (
            <span key={date} aria-label={label} className={cls}>
              {n}
            </span>
          );
        })}
      </div>
      {(used.length > 0 || (shared && everyoneOnce)) && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-encre">
          {used.map((m) => (
            <li key={m} className="flex items-center gap-[5px]">
              <i className="w-2 h-2 rounded-full" style={{ background: MOOD_META[m].color }} />
              {MOOD_META[m].label}
            </li>
          ))}
          {shared && everyoneOnce && (
            <li className="flex items-center gap-[5px]">
              <i className="w-1.5 h-1.5 rounded-full bg-noir" />
              {members.length === 2 ? "Vous deux avez écrit" : "Tout le monde a écrit"}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function EntryIndex({ journal, members, userId, month, entries, listOnMobile }: Props) {
  if (!entries.length) return null;
  const isIntime = journal.kind === "intime";
  return (
    <section aria-label={`Entrées de ${MONTHS[month]}`} className={`${listOnMobile ? "flex" : "hidden lg:flex"} flex-col`}>
      <h2 className="surtitre mb-1.5">Entrées de {MONTHS[month]}</h2>
      {entries.slice(0, 12).map((e) => (
        <Link
          key={e.id}
          href={`/journaux/${journal.id}?mois=${e.entry_date.slice(0, 7)}#${e.entry_date}`}
          className="flex gap-3 items-start py-2.5 border-b border-noir/8 last:border-0 hover:opacity-75"
        >
          <i className="w-2.5 h-2.5 mt-1.5 shrink-0 rounded-full" style={{ background: e.mood ? MOOD_META[e.mood].color : "#E8E1D6" }} />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="titre text-lg leading-snug truncate">{e.title || firstWords(e.content_text)}</span>
            <span className="text-xs text-doux">
              {formatLongDate(e.entry_date)}
              {!isIntime && ` · ${authorName(e.author_id, members, userId)}`}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}

function firstWords(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 40).trimEnd()}…` : t;
}
