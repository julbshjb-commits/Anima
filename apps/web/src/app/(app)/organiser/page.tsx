import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { MOOD_META, formatLongDate, todayIn, toIsoDate, parseIsoDate, zonedParts } from "@anima/core";
import { getDoneTasks, getOrganiser, getProjectTasks, type OrganiserData } from "@/lib/organiser";
import type { Task } from "@/lib/database.types";
import { MONTHS } from "@/lib/format";
import { IconPlus, IconRetour, IconSoleil } from "@/components/icons";
import { LegalFooter } from "@/components/LegalPage";
import { archiveProject, archiveRitual, deleteEvent, deleteTask, toggleRitual, toggleTask } from "./actions";
import { NewEvent, NewProject, NewRitual, QuickAdd } from "./Forms";

export const metadata: Metadata = { title: "M'organiser" };

const DAYS_SHORT = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const shift = (day: string, n: number) => {
  const d = parseIsoDate(day);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const mondayOf = (day: string) => shift(day, -((parseIsoDate(day).getDay() + 6) % 7));

export default function OrganiserPage(props: PageProps<"/organiser">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Organiser {...props} />
    </Suspense>
  );
}

type Vue = "jour" | "semaine" | "termine" | "projet";

async function Organiser({ searchParams }: PageProps<"/organiser">) {
  await connection();
  const sp = await searchParams;
  const today = todayIn();
  const day = typeof sp.jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.jour) ? sp.jour : today;
  const vue: Vue = sp.vue === "semaine" || sp.vue === "termine" || sp.vue === "projet" ? sp.vue : "jour";
  const projectId = typeof sp.projet === "string" && /^[0-9a-f-]{36}$/i.test(sp.projet) ? sp.projet : null;
  const from = mondayOf(day);
  const to = shift(from, 6);
  const data = await getOrganiser(from, to, today);
  const project = projectId ? data.projects.find((p) => p.id === projectId) : undefined;

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <Sidebar data={data} vue={project ? "projet" : vue} projectId={project?.id} />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-5 py-7 lg:px-10 lg:py-8 flex flex-col gap-7">
          {vue === "termine" ? (
            <Termine />
          ) : project ? (
            <Projet title={project.title} color={MOOD_META[project.color].color} id={project.id} data={data} today={today} />
          ) : vue === "semaine" ? (
            <Semaine data={data} from={from} today={today} />
          ) : (
            <Jour data={data} day={day} from={from} today={today} />
          )}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}

function Sidebar({ data, vue, projectId }: { data: OrganiserData; vue: Vue; projectId?: string }) {
  const item = "flex items-center gap-3 h-10 px-2.5 rounded-lg text-sm";
  const on = "bg-papier shadow-[0_0_0_1px_rgba(21,21,21,.08)] font-medium";
  const off = "text-encre hover:bg-lin";
  const views = [
    { id: "jour", href: "/organiser", label: "Aujourd'hui", n: data.counts.today },
    { id: "semaine", href: "/organiser?vue=semaine", label: "Semaine", n: data.counts.week },
    { id: "termine", href: "/organiser?vue=termine", label: "Terminé", n: data.counts.done },
  ] as const;
  return (
    <aside className="lg:w-[248px] shrink-0 px-5 py-5 lg:py-7 border-b lg:border-b-0 lg:border-r border-trait flex flex-col gap-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
      <div className="flex items-center gap-2.5">
        <Link href="/aujourdhui" aria-label="Retour à l'accueil" className="w-9 h-9 shrink-0 rounded-full border border-noir/12 grid place-items-center hover:bg-lin">
          <IconRetour size={16} />
        </Link>
        <span className="titre text-[26px] leading-none">M'organiser</span>
      </div>
      <a href="#ajouter" className="hidden lg:flex items-center justify-center gap-2 h-11 rounded-full bg-noir text-casse text-sm font-medium">
        <IconPlus size={16} />
        Ajouter une tâche
      </a>
      <nav aria-label="Vues" className="flex lg:flex-col gap-0.5 overflow-x-auto">
        {views.map((v) => (
          <Link key={v.id} href={v.href} aria-current={vue === v.id ? "page" : undefined} className={`${item} ${vue === v.id ? on : off} shrink-0`}>
            {v.id === "jour" && <IconSoleil size={16} />}
            <span className="flex-1">{v.label}</span>
            {v.n > 0 && <span className="text-xs text-doux">{v.n}</span>}
          </Link>
        ))}
      </nav>
      <section className="hidden lg:flex flex-col gap-1">
        <h2 className="surtitre mb-1.5 px-0">Projets</h2>
        {data.projects.map((p) => (
          <Link key={p.id} href={`/organiser?vue=projet&projet=${p.id}`} aria-current={projectId === p.id ? "page" : undefined} className={`${item} ${projectId === p.id ? on : off}`}>
            <i className="w-2.5 h-2.5 rounded-[3px]" style={{ background: MOOD_META[p.color].color }} />
            <span className="flex-1 truncate">{p.title}</span>
            {p.open > 0 && <span className="text-xs text-doux">{p.open}</span>}
          </Link>
        ))}
        <div className="mt-1.5">
          <NewProject />
        </div>
      </section>
      <p className="hidden lg:block mt-auto text-xs leading-normal text-doux">
        Pas de tableau à colonnes, pas de base de données : juste ta journée, ta semaine, et ce que tu as prévu.
      </p>
    </aside>
  );
}

function Jour({ data, day, from, today }: { data: OrganiserData; day: string; from: string; today: string }) {
  const isToday = day === today;
  const tasks = data.tasks.filter((t) => t.due_date === day || (isToday && !t.done_at && t.due_date !== null && t.due_date < today));
  const someday = isToday ? data.tasks.filter((t) => !t.done_at && !t.due_date) : [];
  const events = data.events.filter((e) => zonedParts(e.starts_at).day === day);
  const open = tasks.filter((t) => !t.done_at).length;
  const d = parseIsoDate(day);
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="surtitre">
          {MONTHS[d.getMonth()]} {d.getFullYear()}
        </p>
        <h1 className="titre text-[44px] leading-[1.05]">{formatLongDate(day)}</h1>
        <p className="text-sm text-doux">
          {open} tâche{open > 1 ? "s" : ""}, {events.length} rendez-vous.{open + events.length <= 5 ? " Une journée à ta mesure." : ""}
        </p>
      </header>

      <WeekStrip data={data} from={from} day={day} today={today} />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        <section aria-label="À faire" className="min-w-0 flex flex-col gap-2.5">
          <h2 className="surtitre mb-1">{isToday ? "À faire aujourd'hui" : `À faire ${formatLongDate(day).toLowerCase()}`}</h2>
          {tasks.length === 0 && <p className="text-sm text-doux py-2">Rien de prévu. Ajoute une tâche ci-dessous, ou profite.</p>}
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} data={data} today={today} />
          ))}
          <div className="mt-2">
            <QuickAdd day={day} projects={data.projects} />
          </div>
          {someday.length > 0 && (
            <>
              <h2 className="surtitre mt-5 mb-1">Quand tu veux</h2>
              {someday.map((t) => (
                <TaskRow key={t.id} t={t} data={data} today={today} />
              ))}
            </>
          )}
        </section>

        <div className="min-w-0 flex flex-col gap-7">
          <section aria-label="Agenda" className="flex flex-col gap-2.5">
            <h2 className="surtitre mb-1">Agenda</h2>
            {events.length === 0 && <p className="text-sm text-doux">Aucun rendez-vous.</p>}
            {events.map((e) => {
              const start = zonedParts(e.starts_at).time;
              const end = e.ends_at ? zonedParts(e.ends_at).time : null;
              return (
                <div key={e.id} className="group flex gap-3.5 items-stretch">
                  <span className="w-11 pt-3 text-[13px] text-doux text-right shrink-0">{start.replace(/^0/, "")}</span>
                  <div className="flex-1 min-w-0 rounded-[10px] px-3.5 py-2.5 flex items-start gap-2" style={{ background: `${MOOD_META[e.color].color}33` }}>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[15px] font-medium">{e.title}</span>
                      <span className="text-xs text-encre">{[end && `jusqu'à ${end.replace(/^0/, "")}`, e.place].filter(Boolean).join(" · ")}</span>
                    </span>
                    <form action={deleteEvent} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" aria-label={`Supprimer ${e.title}`} className="text-xs text-doux hover:text-terre">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
            <NewEvent day={day} />
          </section>

          <Rituels data={data} from={from} today={today} />
        </div>
      </div>
    </>
  );
}

function WeekStrip({ data, from, day, today }: { data: OrganiserData; from: string; day: string; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => shift(from, i));
  return (
    <nav aria-label="Semaine" className="flex items-stretch gap-1 rounded-xl bg-lin p-1.5">
      <Link href={`/organiser?jour=${shift(from, -7)}`} aria-label="Semaine précédente" className="w-8 grid place-items-center rounded-lg hover:bg-papier">
        <IconRetour size={14} />
      </Link>
      {days.map((d, i) => {
        const n = data.tasks.filter((t) => t.due_date === d).length + data.events.filter((e) => zonedParts(e.starts_at).day === d).length;
        const sel = d === day;
        return (
          <Link
            key={d}
            href={d === today ? "/organiser" : `/organiser?jour=${d}`}
            aria-current={sel ? "date" : undefined}
            className={`flex-1 min-w-0 flex flex-col items-center gap-1 py-2.5 rounded-[9px] ${sel ? "bg-noir text-casse" : "hover:bg-papier"}`}
          >
            <span className={`text-[10px] sm:text-[11px] tracking-[.1em] uppercase ${sel ? "text-casse/80" : "text-doux"}`}>{DAYS_SHORT[i]}</span>
            <span className={`titre text-xl sm:text-2xl leading-none ${d === today && !sel ? "underline underline-offset-4" : ""}`}>{Number(d.slice(8))}</span>
            <span className="flex gap-[3px] h-1">
              {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                <i key={k} className={`w-1 h-1 rounded-full ${sel ? "bg-casse" : "bg-encre"}`} />
              ))}
            </span>
          </Link>
        );
      })}
      <Link href={`/organiser?jour=${shift(from, 7)}`} aria-label="Semaine suivante" className="w-8 grid place-items-center rounded-lg hover:bg-papier rotate-180">
        <IconRetour size={14} />
      </Link>
    </nav>
  );
}

function TaskRow({ t, data, today }: { t: Task; data: OrganiserData; today: string }) {
  const p = data.projects.find((x) => x.id === t.project_id);
  const late = !t.done_at && t.due_date && t.due_date < today;
  const meta = [
    late && `en retard · ${formatLongDate(t.due_date!).toLowerCase()}`,
    t.due_time && `avant ${t.due_time.slice(0, 5).replace(":", " h ").replace(/ h 00$/, " h")}`,
    p?.title,
    t.duration_min && `${t.duration_min} min`,
  ].filter(Boolean);
  return (
    <div className="group flex items-start gap-3.5 rounded-xl bg-papier border border-noir/8 px-4 py-3.5">
      <form action={toggleTask} className="pt-0.5">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
        <button
          type="submit"
          aria-label={t.done_at ? `Rouvrir « ${t.title} »` : `Terminer « ${t.title} »`}
          className={`w-[22px] h-[22px] rounded-md grid place-items-center border-[1.5px] ${t.done_at ? "bg-noir border-noir text-casse" : "border-noir/40 hover:border-noir"}`}
        >
          {t.done_at && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 12 5 5 9-10" />
            </svg>
          )}
        </button>
      </form>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className={`text-[15px] ${t.done_at ? "line-through text-doux" : ""}`}>{t.title}</span>
        {meta.length > 0 && <span className={`text-xs ${late ? "text-terre" : "text-doux"}`}>{meta.join(" · ")}</span>}
      </span>
      <form action={deleteTask} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <input type="hidden" name="id" value={t.id} />
        <button type="submit" aria-label={`Supprimer « ${t.title} »`} className="text-xs text-doux hover:text-terre">
          Supprimer
        </button>
      </form>
    </div>
  );
}

function Rituels({ data, from, today }: { data: OrganiserData; from: string; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => shift(from, i));
  return (
    <section aria-label="Mes rituels" className="rounded-xl bg-papier border border-noir/8 p-5 flex flex-col gap-3.5">
      <h2 className="surtitre">Mes rituels · cette semaine</h2>
      {data.rituals.length === 0 && <p className="text-sm text-doux">Une habitude à tenir ? Ajoute-la, puis coche les jours où tu l'as faite.</p>}
      {data.rituals.map((r) => (
        <div key={r.id} className="group flex items-center gap-3">
          <span className="flex-1 min-w-0 text-sm truncate">{r.title}</span>
          <span className="flex gap-1.5">
            {days.map((d, i) => {
              const checked = data.checks.some((c) => c.ritual_id === r.id && c.day === d);
              const future = d > today;
              return (
                <form key={d} action={toggleRitual}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="day" value={d} />
                  <input type="hidden" name="done" value={checked ? "0" : "1"} />
                  <button
                    type="submit"
                    disabled={future}
                    aria-label={`${r.title}, ${DAYS_SHORT[i]} : ${checked ? "fait" : "pas fait"}`}
                    aria-pressed={checked}
                    className={`w-[15px] h-[15px] rounded-full border ${checked ? "bg-noir border-noir" : "border-noir/30 hover:border-noir"} ${d === today ? "ring-1 ring-offset-1 ring-noir/40" : ""} disabled:opacity-35`}
                  />
                </form>
              );
            })}
          </span>
          <form action={archiveRitual} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" aria-label={`Retirer le rituel ${r.title}`} className="text-xs text-doux hover:text-terre">
              ×
            </button>
          </form>
        </div>
      ))}
      <NewRitual />
    </section>
  );
}

function Semaine({ data, from, today }: { data: OrganiserData; from: string; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => shift(from, i));
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="surtitre">Semaine</p>
        <h1 className="titre text-[44px] leading-[1.05]">
          Du {Number(from.slice(8))} au {formatLongDate(days[6]!).toLowerCase().replace(/^\S+ /, "")}
        </h1>
      </header>
      <WeekStrip data={data} from={from} day="" today={today} />
      <div className="flex flex-col gap-6 max-w-3xl">
        {days.map((d) => {
          const tasks = data.tasks.filter((t) => t.due_date === d);
          const events = data.events.filter((e) => zonedParts(e.starts_at).day === d);
          return (
            <section key={d} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-3">
                <Link href={`/organiser?jour=${d}`} className={`titre text-2xl hover:underline underline-offset-4 ${d === today ? "" : ""}`}>
                  {formatLongDate(d)}
                </Link>
                {d === today && <span className="text-xs text-doux">aujourd'hui</span>}
              </h2>
              {events.map((e) => (
                <p key={e.id} className="text-sm text-encre flex items-center gap-2">
                  <i className="w-2 h-2 rounded-full" style={{ background: MOOD_META[e.color].color }} />
                  {zonedParts(e.starts_at).time} · {e.title}
                </p>
              ))}
              {tasks.map((t) => (
                <TaskRow key={t.id} t={t} data={data} today={today} />
              ))}
              {tasks.length + events.length === 0 && <p className="text-sm text-doux">Rien de prévu.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

async function Termine() {
  const [tasks, data] = await Promise.all([getDoneTasks(), getOrganiser(todayIn(), todayIn(), todayIn())]);
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="surtitre">Terminé</p>
        <h1 className="titre text-[44px] leading-[1.05]">Ce que tu as fait</h1>
      </header>
      <div className="flex flex-col gap-2.5 max-w-3xl">
        {tasks.length === 0 && <p className="text-sm text-doux">Les tâches cochées apparaîtront ici.</p>}
        {tasks.map((t) => (
          <TaskRow key={t.id} t={t} data={data} today={todayIn()} />
        ))}
      </div>
    </>
  );
}

async function Projet({ id, title, color, data, today }: { id: string; title: string; color: string; data: OrganiserData; today: string }) {
  const tasks = await getProjectTasks(id);
  const open = tasks.filter((t) => !t.done_at);
  const closed = tasks.filter((t) => t.done_at);
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="surtitre flex items-center gap-2">
            <i className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
            Projet
          </p>
          <h1 className="titre text-[44px] leading-[1.05]">{title}</h1>
          <p className="text-sm text-doux">
            {open.length} à faire · {closed.length} terminée{closed.length > 1 ? "s" : ""}
          </p>
        </div>
        <form action={archiveProject}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="text-[13px] text-doux hover:text-noir underline-offset-4 hover:underline">
            Archiver le projet
          </button>
        </form>
      </header>
      <div className="flex flex-col gap-2.5 max-w-3xl">
        {open.map((t) => (
          <TaskRow key={t.id} t={t} data={data} today={today} />
        ))}
        <div className="mt-2">
          <QuickAdd day="" projects={data.projects} projectId={id} />
        </div>
        {closed.length > 0 && <h2 className="surtitre mt-5 mb-1">Terminées</h2>}
        {closed.map((t) => (
          <TaskRow key={t.id} t={t} data={data} today={today} />
        ))}
      </div>
    </>
  );
}
