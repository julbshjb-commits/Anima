import Link from "next/link";
import { Suspense } from "react";
import { JOURNAL_KIND_LABELS, MOOD_META, formatLongDate, monthGrid, toIsoDate, type Mood } from "@anima/core";
import { getJournal, getMonthEntries } from "@/lib/data";
import { Cover } from "@/components/Cover";
import { MoodDot } from "@/components/Mood";
import { btn, btnGhost, card } from "@/components/ui";
import { LiveRefresh } from "./LiveRefresh";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default function JournalPage(props: PageProps<"/journaux/[id]">) {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Suspense fallback={<p className="text-doux">Ouverture du journal…</p>}>
        <Journal {...props} />
      </Suspense>
    </main>
  );
}

function parseMonth(raw: unknown): { y: number; m: number } {
  const now = new Date();
  if (typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number) as [number, number];
    if (m >= 1 && m <= 12) return { y, m: m - 1 };
  }
  return { y: now.getFullYear(), m: now.getMonth() };
}
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

async function Journal({ params, searchParams }: PageProps<"/journaux/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { journal, members, myRole, user } = await getJournal(id);
  const { y, m } = parseMonth(sp.mois);
  const grid = monthGrid(y, m);
  const first = toIsoDate(new Date(y, m, 1));
  const last = toIsoDate(new Date(y, m + 1, 0));
  const entries = await getMonthEntries(journal.id, first, last);
  const today = toIsoDate(new Date());
  const isIntime = journal.kind === "intime";
  const canWrite = myRole !== "reader";
  const nameOf = new Map(members.map((p) => [p.id, p.display_name]));

  const byDay = new Map<string, { mood: Mood | null; authors: Set<string> }>();
  for (const e of entries) {
    const d = byDay.get(e.entry_date) ?? { mood: null, authors: new Set<string>() };
    d.mood ??= e.mood;
    d.authors.add(e.author_id);
    byDay.set(e.entry_date, d);
  }
  const prev = m === 0 ? monthKey(y - 1, 11) : monthKey(y, m - 1);
  const next = m === 11 ? monthKey(y + 1, 0) : monthKey(y, m + 1);

  return (
    <div className="flex flex-col gap-10">
      {!isIntime && <LiveRefresh journalId={journal.id} />}
      <header className="flex flex-wrap items-center gap-6">
        <Cover cover={journal.cover} className="w-20" />
        <div className="flex-1 min-w-60 flex flex-col gap-1">
          <Link href="/journaux" className="text-sm text-doux hover:underline underline-offset-4">
            ← Journaux
          </Link>
          <h1 className="titre text-5xl">{journal.title}</h1>
          <p className="text-sm text-doux">
            {isIntime
              ? "Journal intime · visible par toi seul"
              : `${JOURNAL_KIND_LABELS[journal.kind]} · ${members.map((p) => (p.id === user.id ? "toi" : p.display_name)).join(", ")}`}
          </p>
        </div>
        <div className="flex gap-3">
          {!isIntime && canWrite && (
            <Link href={`/journaux/${journal.id}/inviter`} className={btnGhost}>
              Inviter
            </Link>
          )}
          {canWrite && (
            <Link href={`/journaux/${journal.id}/ecrire?date=${today}`} className={btn}>
              Écrire aujourd'hui
            </Link>
          )}
        </div>
      </header>

      {typeof sp.photos === "string" && (
        <p role="alert" className="text-sm text-terre">
          L'entrée est enregistrée, mais {sp.photos === "1" ? "une photo n'a" : `${sp.photos} photos n'ont`} pas pu être
          envoyée{sp.photos === "1" ? "" : "s"}. Vérifie ta connexion et réessaie plus tard.
        </p>
      )}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        <section aria-label="Calendrier" className={`${card} p-5 flex flex-col gap-4`}>
          <div className="flex items-center justify-between">
            <Link href={`?mois=${prev}`} aria-label="Mois précédent" className="w-10 h-10 rounded-full border border-trait grid place-items-center">
              ‹
            </Link>
            <span className="titre text-2xl capitalize">
              {MONTHS[m]} {y}
            </span>
            <Link href={`?mois=${next}`} aria-label="Mois suivant" className="w-10 h-10 rounded-full border border-trait grid place-items-center">
              ›
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span key={i} className="text-[11px] text-doux">
                {d}
              </span>
            ))}
            {grid.map((date, i) => {
              if (!date) return <span key={i} />;
              const info = byDay.get(date);
              const color = info?.mood ? MOOD_META[info.mood].color : info ? "var(--surface-2)" : "transparent";
              const all = members.length > 1 && info && info.authors.size === members.length;
              const label = `${formatLongDate(date)}${info ? ` · ${info.authors.size} entrée(s)` : ""}`;
              const inner = (
                <>
                  <span className={date === today ? "font-semibold underline underline-offset-4" : ""}>{Number(date.slice(8))}</span>
                  {all && <span className="absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full bg-texte" />}
                </>
              );
              const cls = "relative aspect-square rounded-lg grid place-items-center text-sm";
              return info ? (
                <a key={date} href={`#${date}`} aria-label={label} className={cls} style={{ background: color }}>
                  {inner}
                </a>
              ) : (
                <span key={date} aria-label={label} className={`${cls} text-doux`}>
                  {inner}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-doux">
            {byDay.size} jour{byDay.size > 1 ? "s" : ""} écrit{byDay.size > 1 ? "s" : ""} ce mois-ci.
            {members.length > 1 && " Un point noir : tout le monde a écrit ce jour-là."}
          </p>
        </section>

        <section aria-label="Entrées du mois" className="flex flex-col gap-5">
          {entries.length === 0 ? (
            <div className={`${card} p-8 flex flex-col gap-2`}>
              <h2 className="titre text-3xl">Page blanche.</h2>
              <p className="text-doux">Aucune entrée en {MONTHS[m]}. La première ligne est souvent la plus simple : comment s'est passée ta journée ?</p>
            </div>
          ) : (
            entries.map((e) => (
              <article key={e.id} id={e.entry_date} className={`${card} p-6 flex flex-col gap-3 scroll-mt-24`}>
                <header className="flex items-center gap-3 text-sm text-doux">
                  {e.mood && <MoodDot mood={e.mood} size={12} />}
                  <span>{formatLongDate(e.entry_date)}</span>
                  {!isIntime && <span>· {e.author_id === user.id ? "toi" : (nameOf.get(e.author_id) ?? "un ancien membre")}</span>}
                  {e.mood && <span className="ml-auto">{MOOD_META[e.mood].label}</span>}
                  {canWrite && e.author_id === user.id && (
                    <Link href={`/journaux/${journal.id}/entree/${e.id}`} className={`${e.mood ? "" : "ml-auto "}hover:underline underline-offset-4`}>
                      Modifier
                    </Link>
                  )}
                </header>
                {e.title && <h2 className="titre text-3xl">{e.title}</h2>}
                <p className="whitespace-pre-wrap leading-relaxed">{e.content_text}</p>
                {e.photos.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {e.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire, pas d'optimisation possible
                      <img key={p.id} src={p.url} alt="" className="h-40 w-auto rounded-xl object-cover" />
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
