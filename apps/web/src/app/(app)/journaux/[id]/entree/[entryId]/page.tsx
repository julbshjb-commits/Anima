import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { toIsoDate } from "@anima/core";
import { getEntry, getJournal, getMonthEntries } from "@/lib/data";
import { visibilityOf } from "@/lib/format";
import { JournalFrame, membersLabel } from "../../JournalFrame";
import { EntryForm } from "../../ecrire/EntryForm";
import { DeleteEntry } from "./DeleteEntry";

export const metadata: Metadata = { title: "Modifier l'entrée" };

export default function ModifierPage(props: PageProps<"/journaux/[id]/entree/[entryId]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Ouverture de l'entrée…</p>}>
      <Modifier {...props} />
    </Suspense>
  );
}

async function Modifier({ params }: PageProps<"/journaux/[id]/entree/[entryId]">) {
  const { id, entryId } = await params;
  const { journal, members, myRole, user } = await getJournal(id);
  const entry = await getEntry(journal.id, entryId);
  // Seul l'auteur modifie son entrée, et seulement s'il peut encore écrire (la RLS l'impose aussi).
  if (!entry || entry.author_id !== user.id || myRole === "reader") notFound();
  const y = Number(entry.entry_date.slice(0, 4));
  const m = Number(entry.entry_date.slice(5, 7)) - 1;
  const entries = await getMonthEntries(journal.id, toIsoDate(new Date(y, m, 1)), toIsoDate(new Date(y, m + 1, 0)));
  return (
    <JournalFrame journal={journal} members={members} userId={user.id} canWrite year={y} month={m} entries={entries} selected={entry.entry_date}>
      <EntryForm
        journalId={journal.id}
        date={entry.entry_date}
        userId={user.id}
        visibility={visibilityOf(journal.kind, membersLabel(members, user.id))}
        entry={{ id: entry.id, title: entry.title, contentText: entry.content_text, mood: entry.mood, photos: entry.photos }}
      />
      <div className="w-full max-w-[720px] mx-auto px-5 pb-12 lg:px-0">
        <DeleteEntry journalId={journal.id} entryId={entry.id} />
      </div>
    </JournalFrame>
  );
}
