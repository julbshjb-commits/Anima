import type { Metadata } from "next";
import Link from "next/link";
import { NewJournalForm } from "./NewJournalForm";

export const metadata: Metadata = { title: "Nouveau journal" };

export default function NouveauJournal() {
  return (
    <main className="max-w-3xl px-5 py-8 lg:px-12 lg:pt-10 flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href="/journaux" className="text-sm text-doux hover:underline underline-offset-4">
          ← Journaux
        </Link>
        <h1 className="titre text-[44px] leading-[1.05]">Un journal à plusieurs</h1>
        <p className="text-doux">Chacun écrit sa page du jour. Seuls les membres invités peuvent le lire.</p>
      </div>
      <NewJournalForm />
    </main>
  );
}
