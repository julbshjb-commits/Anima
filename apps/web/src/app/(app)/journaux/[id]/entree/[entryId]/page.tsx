import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatLongDate } from "@anima/core";
import { getEntry, getJournal } from "@/lib/data";
import { EntryForm } from "../../ecrire/EntryForm";
import { DeleteEntry } from "./DeleteEntry";

export const metadata: Metadata = { title: "Modifier l'entrée" };

export default function ModifierPage(props: PageProps<"/journaux/[id]/entree/[entryId]">) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Suspense fallback={<p className="text-doux">Ouverture de l'entrée…</p>}>
        <Modifier {...props} />
      </Suspense>
    </main>
  );
}

async function Modifier({ params }: PageProps<"/journaux/[id]/entree/[entryId]">) {
  const { id, entryId } = await params;
  const { journal, myRole, user } = await getJournal(id);
  const entry = await getEntry(journal.id, entryId);
  // Seul l'auteur modifie son entrée, et seulement s'il peut encore écrire (la RLS l'impose aussi).
  if (!entry || entry.author_id !== user.id || myRole === "reader") notFound();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/journaux/${journal.id}?mois=${entry.entry_date.slice(0, 7)}#${entry.entry_date}`} className="text-sm text-doux hover:underline underline-offset-4">
          ← {journal.title}
        </Link>
        <p className="surtitre">Modifier · {formatLongDate(entry.entry_date)}</p>
      </div>
      <EntryForm
        journalId={journal.id}
        date={entry.entry_date}
        userId={user.id}
        entry={{ id: entry.id, title: entry.title, contentText: entry.content_text, mood: entry.mood, photos: entry.photos }}
      />
      <DeleteEntry journalId={journal.id} entryId={entry.id} />
    </div>
  );
}
