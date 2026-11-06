import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { MOOD_META, coverOf, formatLongDate, parseIsoDate, todayIn, toIsoDate, zonedParts, type Mood } from "@anima/core";
import type { Task } from "@/lib/database.types";
import { getMyMoods, listMyJournals, type JournalCard } from "@/lib/data";
import { getTodayTasks } from "@/lib/organiser";
import { toggleTask } from "../../organiser/actions";
import { relativeTime } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { Avatar } from "@/components/Avatar";
import { IconCadenas, IconCrayon } from "@/components/icons";
import { btn, card as surface } from "@/components/ui";
import { createIntimeJournal } from "../journaux/actions";

export const metadata: Metadata = { title: "Aujourd'hui" };

/** Accueil « Aujourd'hui », d'après la maquette Home : uniquement des données réelles. */
export default function AujourdhuiPage() {
  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 lg:pb-14 flex flex-col gap-6">
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Accueil />
      </Suspense>
    </main>
  );
}

const card = `${surface} p-7 flex flex-col gap-5 min-w-0`;

async function Accueil() {
  await connection(); // l'heure et la date dépendent de la requête
  // Le serveur tourne en UTC : la date et l'heure sont celles de Paris.
  const now = new Date();
  const today = todayIn();
  const t = parseIsoDate(today);
  // Cinq semaines complètes, du lundi d'il y a 4 semaines jusqu'à dimanche prochain.
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7) - 28);
  const [{ intime, shared, me, userId }, moods, tasks] = await Promise.all([
    listMyJournals(),
    getMyMoods(toIsoDate(monday)),
    getTodayTasks(today),
  ]);
  const name = me?.display_name;
  const h = Number(zonedParts(now.toISOString()).time.slice(0, 2));
  const hello = h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
  const streak = streakOf(moods.map((m) => m.entry_date), today);

  // Le journal partagé le plus actif : là où quelqu'un d'autre a écrit en dernier.
  const focus = shared.find((j) => j.members.length > 1) ?? shared[0] ?? null;
  const writeHref = focus ? `/journaux/${focus.id}/ecrire?date=${today}` : intime ? `/journaux/${intime.id}/ecrire?date=${today}` : "/journaux/nouveau";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="surtitre">{formatLongDate(today)}</p>
          <h1 className="titre text-[44px] lg:text-[56px] leading-[1.02]">
            {hello}
            {name ? (
              <>
                , <em className="italic font-light champagne pr-2">{name}</em>
              </>
            ) : null}
          </h1>
          {streak > 1 && (
            <span className="mt-1 self-start inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3.5 rounded-full bg-papier border border-trait text-[13px] font-medium">
              <svg className="flamme" width="13" height="15" viewBox="0 0 14 16" aria-hidden>
                <path d="M7 0C8 4 13 6 13 10.5A6 6 0 0 1 1 10.5C1 8 3 6.5 4 5c.5 2 1.5 3 2.5 3C6 5 6 2.5 7 0z" fill="#e2774f" />
              </svg>
              {streak} jours d'affilée
            </span>
          )}
        </div>
        <Link href={writeHref} className={btn}>
          <IconCrayon size={16} />
          Écrire
        </Link>
      </header>

      {shared.length > 0 && <Bubbles journals={shared} me={userId} now={now.getTime()} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FocusCard j={focus} me={userId} today={today} />
        <IntimeCard j={intime} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <section className={card}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="titre text-2xl">Journaux partagés</h2>
            <Link href="/journaux?vue=partages" className="text-[13px] underline underline-offset-4">
              Tout voir
            </Link>
          </div>
          {shared.length ? (
            <ul className="flex flex-col gap-4">
              {shared.slice(0, 4).map((j) => (
                <li key={j.id}>
                  <Link href={`/journaux/${j.id}`} className="flex items-center gap-3.5 hover:opacity-75">
                    <Cover cover={j.cover} className="w-9 shrink-0" />
                    <span className="flex flex-col min-w-0">
                      <span className="text-[15px] font-medium truncate">{j.title}</span>
                      <span className="text-[13px] text-doux truncate">{activity(j, userId)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-doux leading-relaxed">
              Pas encore de journal à plusieurs.{" "}
              <Link href="/journaux/nouveau" className="underline underline-offset-4 text-noir">
                En créer un
              </Link>{" "}
              ou{" "}
              <Link href="/rejoindre" className="underline underline-offset-4 text-noir">
                entrer un code
              </Link>
              .
            </p>
          )}
        </section>

        <TodayTasks tasks={tasks} />
        <MoodWeeks monday={monday} today={today} moods={moods} />
      </div>
    </>
  );
}

/** Jours d'écriture d'affilée, jusqu'à aujourd'hui (ou hier si la page du jour n'est pas encore écrite). */
function streakOf(dates: string[], today: string) {
  const set = new Set(dates);
  const t = parseIsoDate(today);
  let n = 0;
  for (let i = set.has(today) ? 0 : 1; ; i++) {
    const d = toIsoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - i));
    if (!set.has(d)) return n;
    n++;
  }
}

/** Les journaux partagés en bulles : un anneau qui tourne quand quelqu'un d'autre y a écrit depuis moins d'un jour. */
function Bubbles({ journals, me, now }: { journals: JournalCard[]; me: string; now: number }) {
  const day = now - 24 * 3600 * 1000;
  const items = journals.map((j) => ({ j, fresh: !!j.last && j.last.author_id !== me && new Date(j.last.created_at).getTime() > day }));
  items.sort((a, b) => Number(b.fresh) - Number(a.fresh));
  return (
    <nav aria-label="Tes journaux partagés" className="-mx-5 lg:-mx-12 px-5 lg:px-12 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
      {items.map(({ j, fresh }) => {
        const c = coverOf(j.cover);
        return (
          <Link key={j.id} href={`/journaux/${j.id}`} className="group flex flex-col items-center gap-2 w-[76px] shrink-0 text-center">
            <span className={`block w-[72px] h-[72px] rounded-full p-[3px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95 ${fresh ? "anneau-neuf" : "bg-[rgba(255,255,255,.08)]"}`}>
              <span
                className="grid place-items-center w-full h-full rounded-full border-[3px] border-casse font-serif italic text-2xl"
                style={{ background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.35), transparent 55%), ${c.bg}`, color: c.fg }}
              >
                {j.title.trim().charAt(0).toLocaleUpperCase("fr-FR")}
              </span>
            </span>
            <span className={`text-xs truncate max-w-full ${fresh ? "font-medium" : "text-doux"}`}>{j.title}</span>
          </Link>
        );
      })}
      <Link href="/journaux/nouveau" className="group flex flex-col items-center gap-2 w-[76px] shrink-0 text-center">
        <span className="grid place-items-center w-[72px] h-[72px] rounded-full border border-dashed border-noir/20 text-2xl text-doux transition-transform duration-300 group-hover:scale-105 group-hover:rotate-90">+</span>
        <span className="text-xs text-doux">Créer</span>
      </Link>
    </nav>
  );
}

function activity(j: JournalCard, me: string) {
  if (!j.last) return "Aucune entrée pour l'instant";
  const who = j.last.author_id === me ? "Tu as écrit" : `${j.members.find((m) => m.id === j.last?.author_id)?.display_name ?? "Quelqu'un"} a écrit`;
  return `${who} ${relativeTime(j.last.created_at)}`;
}

/** Grande carte sombre : le journal partagé du moment, et qui y a déjà écrit aujourd'hui. */
function FocusCard({ j, me, today }: { j: JournalCard | null; me: string; today: string }) {
  if (!j)
    return (
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#111112] text-blanc p-8 lg:p-10 flex flex-col gap-6 justify-between min-h-[300px]">
        <div className="halo" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="voile" aria-hidden />
        <p className="relative surtitre !text-blanc/80">Journaux à plusieurs</p>
        <h2 className="relative titre text-[34px] lg:text-[42px] leading-[1.08] max-w-2xl">Écris à deux, entre amis ou en famille : chacun sa page du jour.</h2>
        <div className="relative">
          <Link href="/journaux/nouveau" className="inline-flex items-center h-12 px-6 rounded-full bg-blanc text-nuit text-sm font-semibold">
            Créer un journal partagé
          </Link>
        </div>
      </section>
    );
  const other = j.last && j.last.author_id !== me && zonedParts(j.last.created_at).day === today ? j.members.find((m) => m.id === j.last?.author_id) : undefined;
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#111112] text-blanc p-8 lg:p-10 flex flex-col gap-6 justify-between min-h-[300px]">
      <div className="halo" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="voile" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <p className="surtitre !text-blanc/80">Question du jour · {j.title}</p>
        {other && (
          <span className="flex items-center gap-2 text-[13px] text-blanc/90">
            <span className="relative">
              <span className="pouls absolute inset-0 rounded-full bg-champagne/50" aria-hidden />
              <span className="relative block rounded-full ring-2 ring-blanc/40">
                <Avatar name={other.display_name} index={1} size={24} />
              </span>
            </span>
            {other.display_name} a déjà écrit
          </span>
        )}
      </div>
      <h2 className="relative titre text-[34px] lg:text-[42px] leading-[1.08] max-w-2xl">
        {QUESTION.split(" ").map((w, i) => (
          <span key={i}>
            <span className="mot" style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
              {w}
            </span>{" "}
          </span>
        ))}
      </h2>
      <div className="relative flex flex-wrap items-center gap-4">
        <Link
          href={`/journaux/${j.id}/ecrire?date=${today}`}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-blanc text-nuit text-sm font-semibold shadow-[0_12px_30px_-10px_rgba(0,0,0,.5)] hover:-translate-y-0.5"
        >
          <IconCrayon size={16} />
          Écrire ma page
        </Link>
        <Link href={`/journaux/${j.id}`} className="text-[13px] text-blanc/75 hover:text-blanc underline-offset-4 hover:underline">
          Lire le journal
        </Link>
      </div>
    </section>
  );
}

const QUESTION = "Qu'est-ce qui a compté aujourd'hui, même un tout petit peu ?";

function IntimeCard({ j }: { j: JournalCard | null }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-anthracite text-blanc p-7 flex flex-col gap-5 justify-between bg-[radial-gradient(circle_at_85%_10%,rgba(194,162,115,.18),transparent_55%),radial-gradient(circle_at_10%_100%,rgba(255,255,255,.06),transparent_50%)]">
      <div className="flex items-center justify-between">
        <p className="surtitre !text-gris-clair">Mon journal intime</p>
        <span className="text-sable">
          <IconCadenas size={20} />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="titre text-[28px] leading-tight">Rien qu'à toi</h2>
        <p className="text-[13px] text-gris-clair leading-normal">
          Visible par toi seul. Jamais lu par une IA.
          {j?.last ? ` Dernière entrée ${relativeTime(j.last.created_at)}.` : ""}
        </p>
      </div>
      <div>
        {j ? (
          <Link href={`/journaux/${j.id}`} className="inline-flex items-center h-11 px-5 rounded-full border border-blanc/25 text-sm hover:bg-blanc/10">
            Ouvrir
          </Link>
        ) : (
          <form action={createIntimeJournal}>
            <button type="submit" className="inline-flex items-center h-11 px-5 rounded-full border border-blanc/25 text-sm hover:bg-blanc/10">
              Le créer
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/** Les tâches du jour (et celles en retard), cochables depuis l'accueil. */
function TodayTasks({ tasks }: { tasks: Task[] }) {
  const doneCount = tasks.filter((t) => t.done_at).length;
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="titre text-2xl">
          <Link href="/organiser" className="hover:underline underline-offset-4">
            Aujourd'hui
          </Link>
        </h2>
        {tasks.length > 0 && (
          <span className="text-[13px] text-doux">
            {doneCount} sur {tasks.length}
          </span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-doux leading-relaxed">
          Rien de prévu.{" "}
          <Link href="/organiser#ajouter" className="underline underline-offset-4 text-noir">
            Ajouter une tâche
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {tasks.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center gap-3">
              <form action={toggleTask}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
                <button
                  type="submit"
                  aria-label={t.done_at ? `Rouvrir « ${t.title} »` : `Terminer « ${t.title} »`}
                  className={`w-[18px] h-[18px] rounded-[4px] grid place-items-center border-[1.5px] ${t.done_at ? "bg-noir border-noir text-casse" : "border-noir/40 hover:border-noir"}`}
                >
                  {t.done_at && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </button>
              </form>
              <span className={`flex-1 min-w-0 truncate text-[15px] ${t.done_at ? "line-through text-doux" : ""}`}>{t.title}</span>
              {t.due_time && <span className="text-xs text-doux">{t.due_time.slice(0, 5).replace(/^0/, "").replace(":00", " h").replace(":", " h ")}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const DARK: Mood[] = ["pensif", "melancolique", "tendu"];

/** « Cinq semaines » : la couleur de tes humeurs, jour par jour, tous journaux confondus. */
function MoodWeeks({ monday, today, moods }: { monday: Date; today: string; moods: { entry_date: string; mood: Mood | null }[] }) {
  const byDay = new Map<string, Mood | null>();
  for (const m of moods) byDay.set(m.entry_date, m.mood ?? byDay.get(m.entry_date) ?? null);
  const days = Array.from({ length: 35 }, (_, i) => toIsoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  const written = days.filter((d) => byDay.has(d)).length;
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="titre text-2xl">Cinq semaines</h2>
        <span className="text-[13px] text-doux">{written ? `${written} jour${written > 1 ? "s" : ""} écrit${written > 1 ? "s" : ""}` : "Tes humeurs"}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="text-[11px] text-doux text-center">
            {d}
          </span>
        ))}
        {days.map((d, i) => {
          const has = byDay.has(d);
          const mood = byDay.get(d) ?? null;
          const future = d > today;
          const label = `${formatLongDate(d)}${has ? (mood ? `, ${MOOD_META[mood].label}` : ", une entrée") : future ? "" : ", pas d'entrée"}`;
          return (
            <span
              key={d}
              title={label}
              aria-label={label}
              className={`aspect-square rounded-[9px] animate-pop ${has ? "" : future ? "" : "shadow-[inset_0_0_0_1px_var(--trait)]"} ${d === today ? "!shadow-[0_0_0_2px_var(--color-casse),0_0_0_3px_var(--color-noir)]" : ""}`}
              style={{ animationDelay: `${0.3 + i * 0.02}s`, ...(has ? { background: mood ? MOOD_META[mood].color : "#E8E1D6", opacity: mood && DARK.includes(mood) ? 1 : undefined } : {}) }}
            />
          );
        })}
      </div>
    </section>
  );
}
