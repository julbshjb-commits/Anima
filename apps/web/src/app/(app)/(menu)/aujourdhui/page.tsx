import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { MOOD_META, formatLongDate, parseIsoDate, todayIn, toIsoDate, zonedParts, type Mood } from "@anima/core";
import type { Task } from "@/lib/database.types";
import { getMyMoods, listMyJournals, type JournalCard } from "@/lib/data";
import { getTodayTasks } from "@/lib/organiser";
import { toggleTask } from "../../organiser/actions";
import { relativeTime } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { Avatar } from "@/components/Avatar";
import { IconCadenas, IconCrayon } from "@/components/icons";
import { btn } from "@/components/ui";
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

const card = "rounded-xl bg-papier border border-noir/8 p-7 flex flex-col gap-5 min-w-0";

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
  const hello = `${h < 5 || h >= 18 ? "Bonsoir" : "Bonjour"}${name ? `, ${name}` : ""}`;

  // Le journal partagé le plus actif : là où quelqu'un d'autre a écrit en dernier.
  const focus = shared.find((j) => j.members.length > 1) ?? shared[0] ?? null;
  const writeHref = focus ? `/journaux/${focus.id}/ecrire?date=${today}` : intime ? `/journaux/${intime.id}/ecrire?date=${today}` : "/journaux/nouveau";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="surtitre">{formatLongDate(today)}</p>
          <h1 className="titre text-[44px] leading-[1.05]">{hello}</h1>
        </div>
        <Link href={writeHref} className={btn}>
          <IconCrayon size={16} />
          Écrire
        </Link>
      </header>

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

function activity(j: JournalCard, me: string) {
  if (!j.last) return "Aucune entrée pour l'instant";
  const who = j.last.author_id === me ? "Tu as écrit" : `${j.members.find((m) => m.id === j.last?.author_id)?.display_name ?? "Quelqu'un"} a écrit`;
  return `${who} ${relativeTime(j.last.created_at)}`;
}

/** Grande carte sombre : le journal partagé du moment, et qui y a déjà écrit aujourd'hui. */
function FocusCard({ j, me, today }: { j: JournalCard | null; me: string; today: string }) {
  if (!j)
    return (
      <section className="rounded-xl bg-noir text-casse p-8 flex flex-col gap-6 justify-between">
        <p className="surtitre !text-sable">Journaux à plusieurs</p>
        <h2 className="titre text-[34px] leading-[1.15] max-w-xl">Écris à deux, entre amis ou en famille : chacun sa page du jour.</h2>
        <div>
          <Link href="/journaux/nouveau" className="inline-flex items-center h-11 px-[22px] rounded-full bg-casse text-noir text-sm font-medium">
            Créer un journal partagé
          </Link>
        </div>
      </section>
    );
  const other = j.last && j.last.author_id !== me && zonedParts(j.last.created_at).day === today ? j.members.find((m) => m.id === j.last?.author_id) : undefined;
  return (
    <section className="rounded-xl bg-noir text-casse p-8 flex flex-col gap-6 justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="surtitre !text-sable">Aujourd'hui · {j.title}</p>
        {other && (
          <span className="flex items-center gap-2 text-[13px] text-gris-clair">
            <Avatar name={other.display_name} index={1} size={22} />
            {other.display_name} a déjà écrit
          </span>
        )}
      </div>
      <h2 className="titre text-[34px] leading-[1.15] max-w-xl">Qu'est-ce qui a compté aujourd'hui, même un tout petit peu ?</h2>
      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/journaux/${j.id}/ecrire?date=${today}`} className="inline-flex items-center h-11 px-[22px] rounded-full bg-casse text-noir text-sm font-medium">
          Écrire ma page
        </Link>
        <Link href={`/journaux/${j.id}`} className="text-[13px] text-gris-clair hover:text-casse">
          Lire le journal
        </Link>
      </div>
    </section>
  );
}

function IntimeCard({ j }: { j: JournalCard | null }) {
  return (
    <section className="rounded-xl bg-anthracite text-casse p-7 flex flex-col gap-5 justify-between">
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
          <Link href={`/journaux/${j.id}`} className="inline-flex items-center h-11 px-5 rounded-full border border-casse/30 text-sm hover:bg-casse/10">
            Ouvrir
          </Link>
        ) : (
          <form action={createIntimeJournal}>
            <button type="submit" className="inline-flex items-center h-11 px-5 rounded-full border border-casse/30 text-sm hover:bg-casse/10">
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
        {days.map((d) => {
          const has = byDay.has(d);
          const mood = byDay.get(d) ?? null;
          const future = d > today;
          const label = `${formatLongDate(d)}${has ? (mood ? `, ${MOOD_META[mood].label}` : ", une entrée") : future ? "" : ", pas d'entrée"}`;
          return (
            <span
              key={d}
              title={label}
              aria-label={label}
              className={`aspect-square rounded-md ${has ? "" : future ? "" : "shadow-[inset_0_0_0_1px_rgba(21,21,21,.12)]"} ${d === today ? "!shadow-[0_0_0_2px_#F5F3EE,0_0_0_3px_#151515]" : ""}`}
              style={has ? { background: mood ? MOOD_META[mood].color : "#E8E1D6", opacity: mood && DARK.includes(mood) ? 1 : undefined } : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
