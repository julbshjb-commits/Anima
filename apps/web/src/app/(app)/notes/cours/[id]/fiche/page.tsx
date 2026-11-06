import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatLongDate } from "@anima/core";
import { getFiche } from "@/lib/notes";
import { IconRetour } from "@/components/icons";
import { PrintButton } from "../Live";
import { RichText } from "../../../RichText";

export const metadata: Metadata = { title: "Fiche de révision" };

export default function FichePage(props: PageProps<"/notes/cours/[id]/fiche">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Fiche {...props} />
    </Suspense>
  );
}

/** Toutes les séances d'un carnet de cours, dans l'ordre, prêtes à imprimer. */
async function Fiche({ params }: PageProps<"/notes/cours/[id]/fiche">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getFiche(id);
  if (!data) notFound();
  const name = (u: string) => data.names[u] ?? "Ancien membre";
  return (
    <main className="flex-1 w-full max-w-[760px] mx-auto px-5 py-8 lg:py-12 flex flex-col gap-10">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/notes/cours/${id}`}
          className="flex items-center gap-2 text-sm text-doux hover:text-noir"
        >
          <IconRetour size={16} />
          Retour au carnet
        </Link>
        <PrintButton label="Imprimer ou PDF" />
      </div>
      <header className="flex flex-col gap-2">
        <p className="surtitre">Fiche de révision</p>
        <h1 className="titre text-[48px] leading-[1.05]">
          {data.notebook.title}
        </h1>
        <p className="text-sm text-doux">
          {data.notes.length} séance{data.notes.length > 1 ? "s" : ""}
          {data.notebook.subtitle ? ` · ${data.notebook.subtitle}` : ""}
        </p>
      </header>
      {data.notes.map((n, i) => {
        const blocks = data.blocks.filter((b) => b.note_id === n.id);
        const questions = blocks.filter((b) => b.kind === "question");
        return (
          <section
            key={n.id}
            className="flex flex-col gap-3 break-inside-avoid-page"
          >
            <p className="surtitre">
              Séance {i + 1}
              {n.session_date ? ` · ${formatLongDate(n.session_date)}` : ""}
            </p>
            <h2 className="titre text-3xl leading-tight">{n.title}</h2>
            {blocks
              .filter((b) => b.kind === "texte")
              .map((b) => (
                <div key={b.id} className="flex flex-col gap-1">
                  <RichText
                    text={b.content}
                    className="text-[16px] leading-[1.7]"
                  />
                  <span className="text-xs text-doux">
                    — {name(b.author_id)}
                  </span>
                </div>
              ))}
            {questions.length > 0 && (
              <ul className="rounded-xl bg-ivoire px-4 py-3 text-sm flex flex-col gap-1">
                {questions.map((q) => (
                  <li key={q.id}>
                    {q.done_at ? "✓" : "?"} {q.content}
                  </li>
                ))}
              </ul>
            )}
            {blocks.length === 0 && (
              <p className="text-sm text-doux">Séance vide.</p>
            )}
          </section>
        );
      })}
    </main>
  );
}
