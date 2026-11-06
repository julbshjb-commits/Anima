import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getStudyQueue } from "@/lib/flashcards";
import { Session } from "./Session";

export const metadata: Metadata = { title: "Révision" };

export default function ReviserPage(props: PageProps<"/flashcards/reviser">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Préparation de la séance…</p>}>
      <Reviser {...props} />
    </Suspense>
  );
}

async function Reviser({ searchParams }: PageProps<"/flashcards/reviser">) {
  await connection();
  const sp = await searchParams;
  const deckId = typeof sp.paquet === "string" && /^[0-9a-f-]{36}$/i.test(sp.paquet) ? sp.paquet : null;
  const q = await getStudyQueue(deckId);
  return <Session initial={q.items} goal={q.dailyGoal} doneBefore={q.doneToday} backHref={deckId ? `/flashcards/paquet?id=${deckId}` : "/flashcards"} />;
}
