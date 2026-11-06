import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { coverOf } from "@anima/core";
import { getDeck } from "@/lib/flashcards";
import { IconRetour } from "@/components/icons";
import { btn, btnGhost, card as surface } from "@/components/ui";
import { AddCard, DeleteDeck, EditDeck } from "../Forms";
import { CardList, ToCheck } from "./CardList";

export const metadata: Metadata = { title: "Paquet" };

export default function DeckPage(props: PageProps<"/flashcards/paquet">) {
  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 lg:pb-14 flex flex-col gap-7 max-w-5xl">
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Deck {...props} />
      </Suspense>
    </main>
  );
}

async function Deck({ searchParams }: PageProps<"/flashcards/paquet">) {
  await connection();
  const { id } = await searchParams;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getDeck(id);
  if (!data) notFound();
  const { deck, cards, notebooks, projects, notes } = data;
  const now = new Date().getTime();
  const active = cards.filter((c) => c.status === "active");
  const toCheck = cards.filter((c) => c.status === "a-verifier");
  const c = coverOf(deck.cover);
  const notebook = notebooks.find((n) => n.id === deck.notebook_id);
  const project = projects.find((p) => p.id === deck.project_id);
  const due = active.filter((x) => !x.suspended && x.schedules.some((s) => s.state === "nouvelle" || Date.parse(s.due_at) <= now + 12 * 3600_000)).length;

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/flashcards" aria-label="Retour aux flashcards" className="w-9 h-9 rounded-full border border-trait grid place-items-center hover:bg-lin">
          <IconRetour size={16} />
        </Link>
        <p className="surtitre">{deck.subject ?? "Flashcards"}</p>
      </div>

      <header className="flex flex-col sm:flex-row gap-6 sm:items-end justify-between">
        <div className="flex items-end gap-5 min-w-0">
          <span aria-hidden className="w-16 h-[86px] shrink-0 rounded-lg shadow-[0_16px_34px_-14px_rgba(0,0,0,.9)]" style={{ background: c.bg }} />
          <div className="flex flex-col gap-1.5 min-w-0">
            <h1 className="titre text-[40px] lg:text-[50px] leading-[1.02]">{deck.title}</h1>
            <p className="text-sm text-doux">
              {[
                `${active.length} carte${active.length > 1 ? "s" : ""}`,
                deck.description,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {(notebook || project) && (
              <p className="flex flex-wrap gap-2 text-xs">
                {notebook && (
                  <Link href={`/notes?carnet=${notebook.id}`} className="h-7 px-3 grid place-items-center rounded-full border border-trait hover:bg-lin">
                    Carnet · {notebook.title}
                  </Link>
                )}
                {project && (
                  <Link href={`/organiser?vue=projet&projet=${project.id}`} className="h-7 px-3 grid place-items-center rounded-full border border-trait hover:bg-lin">
                    Projet · {project.title}
                  </Link>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {due > 0 && (
            <Link href={`/flashcards/reviser?paquet=${deck.id}`} className={btn}>
              Réviser ({due})
            </Link>
          )}
          <Link href={`/flashcards/generer?paquet=${deck.id}`} className={btnGhost}>
            Depuis une note
          </Link>
        </div>
      </header>

      {toCheck.length > 0 && <ToCheck cards={toCheck} notes={notes} now={now} />}

      <section className={`${surface} p-5 lg:p-6 flex flex-col gap-3`}>
        <h2 className="surtitre">Nouvelle carte</h2>
        <AddCard deckId={deck.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="surtitre">Cartes du paquet</h2>
        <CardList cards={active} notes={notes} now={now} />
      </section>

      <details className={`${surface} p-5`}>
        <summary className="cursor-pointer text-sm font-medium">Modifier le paquet</summary>
        <div className="pt-4 flex flex-col gap-5">
          <EditDeck deck={deck} subjects={[]} notebooks={notebooks} projects={projects} />
          <DeleteDeck id={deck.id} count={cards.length} />
        </div>
      </details>
    </>
  );
}
