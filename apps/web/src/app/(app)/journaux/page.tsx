import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JOURNAL_KIND_LABELS } from "@anima/core";
import { listMyJournals, type JournalCard } from "@/lib/data";
import { Cover } from "@/components/Cover";
import { btn, btnGhost, card } from "@/components/ui";
import { createIntimeJournal } from "./actions";

export const metadata: Metadata = { title: "Journaux" };

export default function JournauxPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 flex flex-col gap-12">
      <Suspense fallback={<p className="text-doux">Chargement de tes journaux…</p>}>
        <Journaux />
      </Suspense>
    </main>
  );
}

function greeting(name?: string) {
  const h = new Date().getHours();
  const word = h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
  return name ? `${word}, ${name}` : word;
}

async function Journaux() {
  const { intime, shared, me } = await listMyJournals();
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="surtitre">{greeting(me?.display_name)}</p>
          <h1 className="titre text-5xl">Tes journaux</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/rejoindre" className={btnGhost}>
            J'ai un code
          </Link>
          <Link href="/journaux/nouveau" className={btn}>
            Nouveau journal partagé
          </Link>
        </div>
      </header>

      <section aria-labelledby="intime" className="flex flex-col gap-4">
        <h2 id="intime" className="surtitre">
          Rien qu'à toi
        </h2>
        {intime ? (
          <JournalTile j={intime} subtitle="Journal intime · visible par toi seul" />
        ) : (
          <form action={createIntimeJournal} className={`${card} p-6 flex flex-wrap items-center gap-6 max-w-2xl`}>
            <Cover cover="nuit-encre" className="w-16" />
            <div className="flex-1 min-w-56 flex flex-col gap-1">
              <h3 className="titre text-2xl">Ton journal intime</h3>
              <p className="text-sm text-doux">
                Personne d'autre ne peut le lire, et il ne peut pas être partagé. Même l'IA d'Anima n'y a pas accès.
              </p>
            </div>
            <button type="submit" className={btn}>
              L'ouvrir
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="partages" className="flex flex-col gap-4">
        <h2 id="partages" className="surtitre">
          Journaux partagés
        </h2>
        {shared.length ? (
          <ul className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {shared.map((j) => (
              <li key={j.id}>
                <JournalTile j={j} subtitle={`${JOURNAL_KIND_LABELS[j.kind]} · ${names(j)}`} />
              </li>
            ))}
          </ul>
        ) : (
          <div className={`${card} p-8 max-w-2xl flex flex-col gap-3`}>
            <h3 className="titre text-2xl">Pas encore de journal partagé.</h3>
            <p className="text-sm text-doux leading-relaxed">
              Crée un journal pour deux, pour ta coloc ou ta famille, puis envoie le code d'invitation. Ou entre le code
              qu'on t'a donné.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function names(j: JournalCard) {
  const n = j.members.map((m) => m.display_name);
  if (n.length <= 1) return "toi seul pour l'instant";
  return n.length <= 3 ? n.join(", ") : `${n.slice(0, 2).join(", ")} et ${n.length - 2} autres`;
}

function JournalTile({ j, subtitle }: { j: JournalCard; subtitle: string }) {
  return (
    <Link href={`/journaux/${j.id}`} className={`${card} p-4 flex gap-4 items-center hover:border-texte transition-colors max-w-2xl`}>
      <Cover cover={j.cover} className="w-16 shrink-0" />
      <span className="flex flex-col gap-1 min-w-0">
        <span className="titre text-2xl truncate">{j.title}</span>
        <span className="text-sm text-doux truncate">{subtitle}</span>
      </span>
    </Link>
  );
}
