import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getGenerateSources } from "@/lib/flashcards";
import { requireUser } from "@/lib/auth";
import { aiCardsAvailable } from "@/lib/ia-cartes";
import { IconRetour } from "@/components/icons";
import { Generator } from "./Generator";

export const metadata: Metadata = { title: "Créer des cartes depuis un cours" };

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export default function GenererPage(props: PageProps<"/flashcards/generer">) {
  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 lg:pb-14 flex flex-col gap-7 max-w-5xl">
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Generer {...props} />
      </Suspense>
    </main>
  );
}

async function Generer({ searchParams }: PageProps<"/flashcards/generer">) {
  await connection();
  const sp = await searchParams;
  const [src, { user }] = await Promise.all([getGenerateSources(isUuid(sp.note) ? sp.note : null), requireUser()]);
  // Premier lancement : la matière et la date d'examen choisies servent au nouveau paquet.
  const subject = typeof sp.matiere === "string" && sp.matiere.trim() ? sp.matiere.trim().slice(0, 80) : null;
  const exam = typeof sp.examen === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.examen) ? sp.examen : null;
  const fileId = isUuid(sp.fichier) && src.files.some((f) => f.id === sp.fichier) ? sp.fichier : null;
  const deckId = isUuid(sp.paquet) && src.decks.some((d) => d.id === sp.paquet) ? sp.paquet : null;
  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={deckId ? `/flashcards/paquet?id=${deckId}` : "/flashcards"} aria-label="Retour" className="w-9 h-9 rounded-full border border-trait grid place-items-center hover:bg-lin">
          <IconRetour size={16} />
        </Link>
        <p className="surtitre">Flashcards</p>
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="titre text-[40px] lg:text-[50px] leading-[1.02]">
          Des cartes <em className="italic champagne pr-1">depuis tes cours</em>
        </h1>
        <p className="text-doux max-w-2xl leading-relaxed">
          Colle un cours, choisis une note ou importe un PDF : Anima te propose des cartes, tu les relis, tu corriges ou retires ce qui ne va pas, puis tu les ranges dans un
          paquet. Rien n'est enregistré avant que tu appuies sur « Garder ».
        </p>
      </header>
      <Generator
        userId={user.id}
        notes={src.notes}
        files={src.files}
        decks={src.decks}
        initialNote={src.note}
        initialFile={fileId}
        initialDeck={deckId}
        initialSubject={deckId ? null : subject}
        initialExam={deckId ? null : exam}
        aiAvailable={aiCardsAvailable()}
      />
    </>
  );
}
