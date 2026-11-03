import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { toIsoDate } from "@anima/core";
import { getJournal, getMonthEntries } from "@/lib/data";
import { visibilityOf } from "@/lib/format";
import { JournalFrame, membersLabel } from "../JournalFrame";
import { EntryForm } from "./EntryForm";

export const metadata: Metadata = { title: "Écrire" };

export default function EcrirePage(props: PageProps<"/journaux/[id]/ecrire">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Préparation de la page…</p>}>
      <Ecrire {...props} />
    </Suspense>
  );
}

async function Ecrire({ params, searchParams }: PageProps<"/journaux/[id]/ecrire">) {
  const { id } = await params;
  const sp = await searchParams;
  const { journal, members, myRole, user } = await getJournal(id);
  if (myRole === "reader") notFound();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : toIsoDate(new Date());
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  const entries = await getMonthEntries(journal.id, toIsoDate(new Date(y, m, 1)), toIsoDate(new Date(y, m + 1, 0)));
  return (
    <JournalFrame journal={journal} members={members} userId={user.id} canWrite year={y} month={m} entries={entries} selected={date}>
      <EntryForm
        journalId={journal.id}
        date={date}
        userId={user.id}
        visibility={visibilityOf(journal.kind, membersLabel(members, user.id))}
      />
    </JournalFrame>
  );
}
