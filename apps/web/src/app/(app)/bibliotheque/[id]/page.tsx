import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WORK_KINDS, WORK_STATUS, progressPercent } from "@anima/core";
import { getWork } from "@/lib/bibliotheque";
import { relativeTime } from "@/lib/format";
import { LegalFooter } from "@/components/LegalPage";
import { IconRetour } from "@/components/icons";
import { deleteQuote, deleteWork } from "../actions";
import { BookCover, Stars } from "../BookCover";
import { EditWork, ProgressForm, QuoteForm } from "../Forms";

export const metadata: Metadata = { title: "Œuvre" };

export default function WorkPage(props: PageProps<"/bibliotheque/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <WorkView {...props} />
    </Suspense>
  );
}

async function WorkView({ params }: PageProps<"/bibliotheque/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getWork(id);
  if (!data) notFound();
  const { work, quotes } = data;
  const p = progressPercent(work.progress, work.progress_total);
  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 w-full max-w-[980px] mx-auto px-5 py-7 lg:py-10 flex flex-col gap-8">
        <Link
          href={`/bibliotheque?vue=${work.kind === "serie" ? "film" : work.kind}`}
          className="flex items-center gap-2 text-sm text-doux hover:text-noir w-fit"
        >
          <IconRetour size={16} />
          Ma bibliothèque
        </Link>
        <header className="flex flex-col sm:flex-row gap-6 sm:gap-8 sm:items-end">
          <span className="w-[140px] shrink-0">
            <BookCover
              cover={work.cover}
              title={work.title}
              creator={work.creator}
            />
          </span>
          <div className="flex flex-col gap-2 min-w-0">
            <p className="surtitre">
              {WORK_KINDS[work.kind].label} · {WORK_STATUS[work.status]}
              {p != null ? ` · ${p} %` : ""}
            </p>
            <h1 className="titre text-[40px] lg:text-[48px] leading-[1.05] break-words">
              {work.title}
            </h1>
            <p className="text-doux">{work.creator}</p>
            <Stars n={work.rating} />
            {work.url && (
              <a
                href={work.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm underline underline-offset-4 break-all"
              >
                Ouvrir le lien
              </a>
            )}
            {WORK_KINDS[work.kind].unit && work.status !== "termine" && (
              <div className="pt-1">
                <ProgressForm work={work} />
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 items-start">
          <section className="flex flex-col gap-3 min-w-0">
            <h2 className="surtitre">Fiche</h2>
            <EditWork work={work} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="surtitre">Citations</h2>
            <QuoteForm workId={work.id} />
            {quotes.map((q) => (
              <figure
                key={q.id}
                className="rounded-xl bg-papier border border-noir/8 px-4 py-3.5 flex flex-col gap-2"
              >
                <blockquote className="font-serif italic text-lg leading-snug">
                  « {q.text} »
                </blockquote>
                <figcaption className="flex items-center gap-3 text-xs text-doux">
                  <span className="flex-1">
                    {[q.source, relativeTime(q.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <form action={deleteQuote}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="workId" value={work.id} />
                    <button type="submit" className="hover:text-terre">
                      Supprimer
                    </button>
                  </form>
                </figcaption>
              </figure>
            ))}
          </section>
        </div>

        <details className="text-sm text-doux">
          <summary className="cursor-pointer hover:text-noir w-fit">
            Retirer de ma bibliothèque
          </summary>
          <form
            action={deleteWork}
            className="mt-3 flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="id" value={work.id} />
            <span>
              Suppression définitive. Les citations restent, sans lien vers
              l'œuvre.
            </span>
            <button
              type="submit"
              className="h-9 px-4 rounded-full border border-terre text-terre text-sm"
            >
              Retirer
            </button>
          </form>
        </details>
      </main>
      <LegalFooter />
    </div>
  );
}
