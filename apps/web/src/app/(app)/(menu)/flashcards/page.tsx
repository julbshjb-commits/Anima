import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { coverOf } from "@anima/core";
import { getOverview, type Overview } from "@/lib/flashcards";
import { requireUser } from "@/lib/auth";
import { btn, btnGhost, card as surface } from "@/components/ui";
import { NewDeck, SettingsForm } from "./Forms";

export const metadata: Metadata = { title: "Flashcards" };

export default function FlashcardsPage() {
  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 lg:pb-14 flex flex-col gap-8">
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Flashcards />
      </Suspense>
    </main>
  );
}

/** Prénom et salutation selon l'heure de Paris. */
async function whoAmI() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = (data?.display_name || user.email?.split("@")[0] || "").split(" ")[0];
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Paris" }).formatToParts(now).find((x) => x.type === "hour")?.value ?? 12);
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  return { name, date, hello: hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour" };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

async function Flashcards() {
  await connection();
  const [o, me] = await Promise.all([getOverview(), whoAmI()]);
  const subjects = [...new Set(o.decks.map((d) => d.subject).filter((s): s is string => !!s))];
  const groups = new Map<string, Overview["decks"]>();
  for (const d of o.decks) {
    const key = d.subject ?? "";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const goalPct = Math.min(100, Math.round((o.today.done / o.settings.daily_goal) * 100));

  return (
    <>
      <header className="entree flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="surtitre">{me.date}</p>
          <h1 className="titre text-[44px] lg:text-[56px] leading-[1.02]">
            {me.hello} <em className="italic champagne pr-2">{me.name}</em>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/flashcards/generer" className={btnGhost}>
            Créer depuis une note
          </Link>
          <NewDeck subjects={subjects} open={o.decks.length === 0} />
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <section style={{ ["--i" as string]: 1 }} className="entree relative isolate overflow-hidden rounded-2xl bg-[#111112] border border-champagne/25 shadow-[0_40px_90px_-50px_rgba(230,200,145,.45)] text-blanc p-8 lg:p-10 flex flex-col gap-6 min-h-[260px] justify-between">
          <div className="halo" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <div className="voile" aria-hidden />
          <p className="relative surtitre !text-blanc/80">Aujourd'hui</p>
          {o.today.dueLeft > 0 ? (
            <>
              <h2 className="relative titre text-[40px] lg:text-[52px] leading-[1.02]">
                <span className="chiffre-or">{plural(o.today.dueLeft, "carte")}</span> <span className="italic text-blanc/70">à revoir</span>
              </h2>
              <p className="relative text-[15px] text-blanc/75">
                {[
                  o.today.learning ? plural(o.today.learning, "en cours d'apprentissage", "en cours d'apprentissage") : null,
                  o.today.newLeft ? plural(o.today.newLeft, "nouvelle") : null,
                  `environ ${Math.max(1, Math.round((o.today.dueLeft * 8) / 60))} min`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="relative">
                <Link href="/flashcards/reviser" className="bouton-or inline-flex items-center h-12 px-7 rounded-full text-nuit text-sm font-semibold shadow-[0_14px_40px_-12px_rgba(224,184,120,.7)]">
                  Commencer la révision
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="relative titre text-[36px] lg:text-[46px] leading-[1.05] max-w-2xl">
                {o.totals.cards === 0 ? "Crée ton premier paquet, ou tire des cartes d'une note." : "Tout est révisé pour aujourd'hui."}
              </h2>
              <p className="relative text-[15px] text-blanc/75">
                {o.totals.cards === 0 ? "Chaque réponse ajuste la date de la prochaine révision : on revoit souvent ce qui résiste, rarement ce qui est su." : "Reviens demain : les prochaines cartes arriveront au bon moment."}
              </p>
            </>
          )}
        </section>

        <section style={{ ["--i" as string]: 2 }} className={`${surface} entree p-6 flex flex-col gap-5`}>
          <div className="flex items-center gap-5">
            <Ring pct={goalPct} />
            <div className="flex flex-col gap-0.5">
              <p className="titre text-[30px] leading-none">
                {o.today.done}
                <span className="text-doux text-lg"> / {o.settings.daily_goal}</span>
              </p>
              <p className="text-xs text-doux">réponses aujourd'hui</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="jours d'affilée" value={o.streak} flame={o.streak > 1} />
            <Stat label="retenues (30 j)" value={o.retention == null ? "—" : `${o.retention} %`} />
            <Stat label="cartes acquises" value={o.totals.mature} />
          </dl>
          <Heatmap days={o.heatmap} />
        </section>
      </div>

      {o.totals.toCheck > 0 && (
        <p className="rounded-2xl border border-champagne/30 bg-champagne/5 px-5 py-4 text-sm">
          {plural(o.totals.toCheck, "carte proposée", "cartes proposées")} par un assistant IA {o.totals.toCheck > 1 ? "attendent" : "attend"} ta relecture : ouvre le paquet pour les garder, les corriger ou les retirer.
        </p>
      )}

      {o.decks.length > 0 && (
        <section style={{ ["--i" as string]: 3 }} className="entree flex flex-col gap-6">
          {[...groups.entries()].map(([subject, decks]) => (
            <div key={subject || "sans"} className="flex flex-col gap-3">
              <h2 className="surtitre">{subject || "Sans matière"}</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                {decks.map((d) => (
                  <DeckTile key={d.id} d={d} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <details className={`${surface} p-5 max-w-2xl`}>
        <summary className="cursor-pointer text-sm font-medium">Rythme de révision</summary>
        <div className="pt-4 flex flex-col gap-3">
          <p className="text-xs text-doux leading-relaxed">
            Le nombre de nouvelles cartes par jour règle la charge des jours suivants : chaque nouvelle carte revient plusieurs fois les premières semaines.
          </p>
          <SettingsForm settings={o.settings} />
        </div>
      </details>
    </>
  );
}

function DeckTile({ d }: { d: Overview["decks"][number] }) {
  const c = coverOf(d.cover);
  const s = d.stats;
  const pct = s.total ? Math.round((s.mature / s.total) * 100) : 0;
  return (
    <li className={`${surface} souleve p-5 flex flex-col gap-4`}>
      <Link href={`/flashcards/paquet?id=${d.id}`} className="flex items-start gap-4 group">
        <span aria-hidden className="relative w-12 h-16 shrink-0 rounded-md shadow-[0_12px_24px_-12px_rgba(0,0,0,.8)]" style={{ background: c.bg }}>
          <span className="absolute inset-x-1.5 top-2 h-[3px] rounded-full opacity-40" style={{ background: c.fg }} />
          <span className="absolute -right-1 -bottom-1 w-12 h-16 rounded-md -z-10 opacity-50" style={{ background: c.bg }} />
        </span>
        <span className="flex flex-col gap-1 min-w-0">
          <span className="titre text-[24px] leading-tight group-hover:underline underline-offset-4 decoration-1">{d.title}</span>
          <span className="text-xs text-doux">
            {plural(s.total, "carte")}
            {s.toCheck ? ` · ${s.toCheck} à relire` : ""}
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-3 text-[13px]">
        <span className={s.due ? "text-champagne font-medium" : "text-doux"}>{s.due} à revoir</span>
        <span className="text-doux">·</span>
        <span className="text-doux">{s.fresh} nouvelle{s.fresh > 1 ? "s" : ""}</span>
        <span className="ml-auto text-xs text-doux tabular-nums">{pct} % acquis</span>
      </div>
      <span className="h-1 rounded-full bg-lin overflow-hidden" aria-hidden>
        <i className="jauge block h-full bg-champagne/80" style={{ width: `${pct}%` }} />
      </span>
      {s.due + s.fresh > 0 && (
        <Link href={`/flashcards/reviser?paquet=${d.id}`} className={`${btn} self-start h-9 px-4 text-[13px]`}>
          Réviser ce paquet
        </Link>
      )}
    </li>
  );
}

function Stat({ label, value, flame }: { label: string; value: number | string; flame?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dd className="titre text-[26px] leading-none flex items-center gap-1">
        {flame && (
          <svg className="flamme" width="12" height="14" viewBox="0 0 14 16" aria-hidden>
            <path d="M7 0C8 4 13 6 13 10.5A6 6 0 0 1 1 10.5C1 8 3 6.5 4 5c.5 2 1.5 3 2.5 3C6 5 6 2.5 7 0z" fill="#e2774f" />
          </svg>
        )}
        {value}
      </dd>
      <dt className="text-[11px] text-doux leading-tight">{label}</dt>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 30;
  const len = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${pct} % de l'objectif du jour`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="url(#or)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(len * pct) / 100} ${len}`}
        transform="rotate(-90 38 38)"
        className="anneau-dessin transition-[stroke-dasharray] duration-700"
      />
      <defs>
        <linearGradient id="or" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f3dcb0" />
          <stop offset="1" stopColor="#c99a5a" />
        </linearGradient>
      </defs>
      <text x="38" y="43" textAnchor="middle" fontSize="14" fill="currentColor" className="font-sans">
        {pct}%
      </text>
    </svg>
  );
}

/** 16 semaines de révisions, une case par jour (plus c'est doré, plus il y a eu de réponses). */
function Heatmap({ days }: { days: { day: string; n: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-doux">16 dernières semaines</p>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] max-w-[340px]" aria-label="Historique des révisions">
        {days.map((d) => (
          <span
            key={d.day}
            title={`${d.day} : ${d.n} réponse${d.n > 1 ? "s" : ""}`}
            className="aspect-square rounded-[3px]"
            style={{ background: d.n ? `rgba(230,200,145,${0.18 + (0.82 * d.n) / max})` : "rgba(255,255,255,.05)" }}
          />
        ))}
      </div>
    </div>
  );
}
