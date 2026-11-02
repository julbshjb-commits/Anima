import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatLongDate, toIsoDate } from "@anima/core";
import { getJournal } from "@/lib/data";
import { EntryForm } from "./EntryForm";

export const metadata: Metadata = { title: "Écrire" };

export default function EcrirePage(props: PageProps<"/journaux/[id]/ecrire">) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Suspense fallback={<p className="text-doux">Préparation de la page…</p>}>
        <Ecrire {...props} />
      </Suspense>
    </main>
  );
}

async function Ecrire({ params, searchParams }: PageProps<"/journaux/[id]/ecrire">) {
  const { id } = await params;
  const sp = await searchParams;
  const { journal, myRole, user } = await getJournal(id);
  if (myRole === "reader") notFound();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : toIsoDate(new Date());
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/journaux/${journal.id}`} className="text-sm text-doux hover:underline underline-offset-4">
          ← {journal.title}
        </Link>
        <p className="surtitre">{formatLongDate(date)}</p>
      </div>
      <EntryForm journalId={journal.id} date={date} userId={user.id} />
    </div>
  );
}
