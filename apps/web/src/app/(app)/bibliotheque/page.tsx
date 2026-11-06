import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  WORK_KINDS,
  WORK_STATUS,
  formatLongDate,
  progressPercent,
  todayIn,
  type WorkKind,
} from "@anima/core";
import { getLibrary, type Library } from "@/lib/bibliotheque";
import type { Work } from "@/lib/database.types";
import { LegalFooter } from "@/components/LegalPage";
import { IconRetour } from "@/components/icons";
import { deleteQuote } from "./actions";
import { BookCover, Stars } from "./BookCover";
import { AddWork, GoalForm, ProgressForm, QuoteForm } from "./Forms";

export const metadata: Metadata = { title: "Ma bibliothèque" };

export default function BibliothequePage(props: PageProps<"/bibliotheque">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Bibliotheque {...props} />
    </Suspense>
  );
}

type Vue = WorkKind | "tout" | "citations";
const SHELVES: { id: Vue; label: string; kinds: WorkKind[] }[] = [
  { id: "livre", label: "Livres", kinds: ["livre"] },
  { id: "film", label: "Films et séries", kinds: ["film", "serie"] },
  { id: "podcast", label: "Podcasts", kinds: ["podcast"] },
  { id: "article", label: "Articles et liens", kinds: ["article"] },
];

async function Bibliotheque({ searchParams }: PageProps<"/bibliotheque">) {
  await connection();
  const sp = await searchParams;
  const today = todayIn();
  const year = Number(today.slice(0, 4));
  const lib = await getLibrary(year);
  const vue: Vue =
    SHELVES.some((s) => s.id === sp.vue) || sp.vue === "citations"
      ? (sp.vue as Vue)
      : "tout";
  const statut =
    sp.statut === "a-lire" ||
    sp.statut === "en-cours" ||
    sp.statut === "termine"
      ? sp.statut
      : null;
  const shelf = SHELVES.find((s) => s.id === vue);
  const works = lib.works.filter(
    (w) =>
      (!shelf || shelf.kinds.includes(w.kind)) &&
      (!statut || w.status === statut),
  );
  const current = lib.works.find(
    (w) => w.status === "en-cours" && (!shelf || shelf.kinds.includes(w.kind)),
  );
  const titleOf = (id: string | null) =>
    lib.works.find((w) => w.id === id)?.title;

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <Sidebar lib={lib} vue={vue} />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-5 py-7 lg:px-10 lg:py-8 flex flex-col gap-8">
          {vue === "citations" ? (
            <section className="flex flex-col gap-4 max-w-3xl">
              <header className="flex flex-col gap-1">
                <p className="surtitre">Ma bibliothèque</p>
                <h1 className="titre text-[44px] leading-[1.05]">
                  Citations gardées
                </h1>
              </header>
              <div className="rounded-2xl bg-papier border border-noir/8 p-5">
                <QuoteForm />
              </div>
              {lib.quotes.length === 0 && (
                <p className="text-doux">
                  Garde ici les phrases qui t'arrêtent, d'un livre, d'un film ou
                  d'un ami.
                </p>
              )}
              {lib.quotes.map((q) => (
                <QuoteCard
                  key={q.id}
                  text={q.text}
                  meta={[titleOf(q.work_id), q.source]
                    .filter(Boolean)
                    .join(" · ")}
                  id={q.id}
                />
              ))}
            </section>
          ) : (
            <>
              {current ? (
                <Current work={current} />
              ) : (
                <header className="flex flex-col gap-1">
                  <p className="surtitre">Ma bibliothèque</p>
                  <h1 className="titre text-[44px] leading-[1.05]">
                    {shelf ? shelf.label : "Tout"}
                  </h1>
                  {lib.works.length === 0 && (
                    <p className="text-doux max-w-xl leading-relaxed mt-2">
                      Ce que tu lis, regardes et écoutes, avec où tu en es et
                      les phrases que tu veux garder. Rien n'est partagé, sauf
                      si tu le publies dans un cercle.
                    </p>
                  )}
                </header>
              )}

              <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_340px] gap-10 items-start">
                <section className="min-w-0 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="surtitre">Mon étagère</h2>
                    <nav
                      aria-label="Filtrer"
                      className="flex gap-1 text-[13px]"
                    >
                      {([null, "en-cours", "a-lire", "termine"] as const).map(
                        (s) => (
                          <Link
                            key={s ?? "tout"}
                            href={`/bibliotheque?${new URLSearchParams({ ...(vue !== "tout" ? { vue } : {}), ...(s ? { statut: s } : {}) })}`}
                            aria-current={statut === s ? "page" : undefined}
                            className={`h-8 px-3 grid place-items-center rounded-full ${statut === s ? "bg-noir text-casse" : "text-doux hover:text-noir"}`}
                          >
                            {s ? WORK_STATUS[s] : "Tout"}
                          </Link>
                        ),
                      )}
                    </nav>
                  </div>
                  {works.length === 0 ? (
                    <p className="text-sm text-doux">
                      Rien ici pour l'instant.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-6">
                      {works.map((w) => (
                        <li key={w.id} className="min-w-0">
                          <Link
                            href={`/bibliotheque/${w.id}`}
                            className="group flex flex-col gap-2"
                          >
                            <BookCover
                              cover={w.cover}
                              title={w.title}
                              creator={w.creator}
                            />
                            <span className="flex flex-col gap-0.5">
                              <span className="text-[13px] font-medium leading-snug line-clamp-2 group-hover:underline">
                                {w.title}
                              </span>
                              {w.rating ? (
                                <Stars n={w.rating} />
                              ) : (
                                <span className="text-[11px] text-doux">
                                  {statusLine(w)}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="surtitre">Citations gardées</h2>
                    {lib.quotes.length > 3 && (
                      <Link
                        href="/bibliotheque?vue=citations"
                        className="text-xs text-doux hover:text-noir"
                      >
                        Tout voir
                      </Link>
                    )}
                  </div>
                  {lib.quotes.slice(0, 3).map((q) => (
                    <QuoteCard
                      key={q.id}
                      text={q.text}
                      meta={[titleOf(q.work_id), q.source]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                  {lib.quotes.length === 0 && (
                    <p className="text-sm text-doux">
                      Aucune citation pour l'instant.
                    </p>
                  )}
                  <p className="text-xs text-doux leading-normal">
                    Une citation partagée dans un cercle peut être gardée ici
                    d'un geste.
                  </p>
                </section>
              </div>
            </>
          )}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}

function statusLine(w: Work) {
  if (w.status === "en-cours") {
    const p = progressPercent(w.progress, w.progress_total);
    return p != null ? `En cours · ${p} %` : "En cours";
  }
  return WORK_STATUS[w.status];
}

function Current({ work }: { work: Work }) {
  const p = progressPercent(work.progress, work.progress_total);
  const unit = WORK_KINDS[work.kind].unit;
  return (
    <section className="rounded-3xl bg-ivoire p-6 lg:p-7 flex flex-col sm:flex-row gap-6 sm:gap-8 sm:items-center">
      <Link
        href={`/bibliotheque/${work.id}`}
        className="w-[120px] lg:w-[150px] shrink-0 relative"
      >
        <BookCover
          cover={work.cover}
          title={work.title}
          creator={work.creator}
        />
        {p != null && (
          <span className="absolute left-0 right-0 -bottom-1 h-1 bg-noir/15 rounded-full overflow-hidden">
            <i className="block h-full bg-champagne" style={{ width: `${p}%` }} />
          </span>
        )}
      </Link>
      <div className="flex flex-col gap-3 min-w-0">
        <p className="surtitre">En cours{p != null ? ` · ${p} %` : ""}</p>
        <h1 className="titre text-[40px] lg:text-[46px] leading-[1.05]">
          {work.title}
        </h1>
        <p className="text-[15px] text-encre">
          {[
            work.creator,
            work.progress != null && unit
              ? `${unit} ${work.progress}${work.progress_total ? ` sur ${work.progress_total}` : ""}`
              : null,
            work.started_on
              ? `commencé le ${formatLongDate(work.started_on).replace(/^\S+\s/, "")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="flex flex-wrap items-start gap-2 pt-1">
          <ProgressForm work={work} dark />
          <QuoteForm workId={work.id} compact />
        </div>
      </div>
    </section>
  );
}

function QuoteCard({
  text,
  meta,
  id,
}: {
  text: string;
  meta: string;
  id?: string;
}) {
  return (
    <figure className="rounded-xl bg-papier border border-noir/8 px-5 py-4 flex flex-col gap-2.5">
      <blockquote className="font-serif italic text-[19px] leading-snug">
        « {text} »
      </blockquote>
      <figcaption className="flex items-center gap-3 text-xs text-doux">
        <span className="flex-1">{meta}</span>
        {id && (
          <form action={deleteQuote}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="hover:text-terre">
              Supprimer
            </button>
          </form>
        )}
      </figcaption>
    </figure>
  );
}

function Sidebar({ lib, vue }: { lib: Library; vue: Vue }) {
  const item =
    "flex items-center gap-3 h-10 px-2.5 rounded-lg text-sm shrink-0";
  const on = "bg-papier shadow-[0_0_0_1px_var(--trait)] font-medium";
  const off = "text-encre hover:bg-lin";
  const count = (kinds: WorkKind[]) =>
    lib.works.filter((w) => kinds.includes(w.kind)).length;
  const pct = lib.goal.target
    ? Math.min(100, Math.round((lib.goal.done / lib.goal.target) * 100))
    : 0;
  return (
    <aside className="lg:w-[256px] shrink-0 px-5 py-5 lg:py-7 border-b lg:border-b-0 lg:border-r border-trait flex flex-col gap-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
      <div className="flex items-center gap-2.5">
        <Link
          href="/aujourdhui"
          aria-label="Retour à l'accueil"
          className="w-9 h-9 shrink-0 rounded-full border border-noir/12 grid place-items-center hover:bg-lin"
        >
          <IconRetour size={16} />
        </Link>
        <Link href="/bibliotheque" className="titre text-[26px] leading-none">
          Ma bibliothèque
        </Link>
      </div>
      <AddWork />
      <nav
        aria-label="Rayons"
        className="flex lg:flex-col gap-0.5 overflow-x-auto max-lg:-mx-5 max-lg:px-5"
      >
        {SHELVES.map((s) => (
          <Link
            key={s.id}
            href={`/bibliotheque?vue=${s.id}`}
            aria-current={vue === s.id ? "page" : undefined}
            className={`${item} ${vue === s.id ? on : off}`}
          >
            <span className="flex-1">{s.label}</span>
            <span className="text-xs text-doux">{count(s.kinds)}</span>
          </Link>
        ))}
        <Link
          href="/bibliotheque?vue=citations"
          aria-current={vue === "citations" ? "page" : undefined}
          className={`${item} ${vue === "citations" ? on : off}`}
        >
          <span className="flex-1">Citations gardées</span>
          <span className="text-xs text-doux">{lib.quotes.length}</span>
        </Link>
      </nav>
      <section className="flex flex-col gap-2">
        <h2 className="surtitre">Objectif {lib.goal.year}</h2>
        {lib.goal.target ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="titre text-[28px] leading-none">
                {lib.goal.done}
              </span>
              <span className="titre text-lg text-doux">
                livre{lib.goal.done > 1 ? "s" : ""} sur {lib.goal.target}
              </span>
            </p>
            <span className="h-1 rounded-full bg-noir/10 overflow-hidden">
              <i
                className="block h-full bg-noir"
                style={{ width: `${pct}%` }}
              />
            </span>
          </>
        ) : (
          <p className="text-xs text-doux leading-normal">
            {lib.goal.done
              ? `${lib.goal.done} livre${lib.goal.done > 1 ? "s" : ""} terminé${lib.goal.done > 1 ? "s" : ""} cette année.`
              : "Pas d'objectif, et c'est très bien aussi."}
          </p>
        )}
        <GoalForm year={lib.goal.year} target={lib.goal.target} />
      </section>
    </aside>
  );
}
