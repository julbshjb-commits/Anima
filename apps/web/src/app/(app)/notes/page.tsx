import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getNotesHome } from "@/lib/notes";
import { relativeTime } from "@/lib/format";
import { LegalFooter } from "@/components/LegalPage";
import { IconPlus } from "@/components/icons";
import { createNote, deleteNotebook } from "./actions";
import { NotesSidebar } from "./NotesSidebar";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage(props: PageProps<"/notes">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Notes {...props} />
    </Suspense>
  );
}

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function Notes({ searchParams }: PageProps<"/notes">) {
  const sp = await searchParams;
  const notebookId = isUuid(sp.carnet) ? sp.carnet : null;
  const tag = typeof sp.tag === "string" && sp.tag.length <= 30 ? sp.tag : null;
  const data = await getNotesHome({ notebookId, tag });
  const notebook = notebookId
    ? data.notebooks.find((n) => n.id === notebookId)
    : undefined;
  const titleOf = (id: string) => data.notebooks.find((n) => n.id === id);

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <NotesSidebar data={data} notebookId={notebookId} tag={tag} />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-5 py-7 lg:px-10 lg:py-8 flex flex-col gap-7 max-w-[920px]">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="surtitre">
                {notebook ? "Carnet perso" : tag ? "Tag" : "Notes"}
              </p>
              <h1 className="titre text-[44px] leading-[1.05]">
                {notebook
                  ? notebook.title
                  : tag
                    ? `#${tag}`
                    : "Toutes mes notes"}
              </h1>
              <p className="text-sm text-doux">
                {data.notes.length} note{data.notes.length > 1 ? "s" : ""}
                {notebook ? " · visible par toi seul" : ""}
              </p>
            </div>
            {notebook && notebook.owner_id === data.userId && (
              <form action={createNote}>
                <input type="hidden" name="notebookId" value={notebook.id} />
                <button
                  type="submit"
                  className="flex items-center gap-2 h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium"
                >
                  <IconPlus size={16} />
                  Nouvelle note
                </button>
              </form>
            )}
          </header>

          {sp.erreur && (
            <p role="alert" className="text-sm text-terre">
              La note n'a pas pu être créée. Réessaie.
            </p>
          )}

          {data.notebooks.length === 0 ? (
            <div className="rounded-2xl bg-papier border border-noir/8 p-8 flex flex-col gap-3 max-w-xl">
              <h2 className="titre text-3xl">Commence par un carnet</h2>
              <p className="text-doux leading-relaxed">
                Un carnet perso pour tes idées et tes révisions, visible par toi
                seul. Ou un carnet de cours partagé, pour prendre les notes à
                plusieurs pendant l'amphi : chacun ajoute ce qu'il a noté, signé
                de son initiale.
              </p>
            </div>
          ) : data.notes.length === 0 ? (
            <p className="text-doux">
              {notebook
                ? "Ce carnet est vide. Ajoute ta première note."
                : "Aucune note ici pour l'instant."}
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.notes.map((n) => {
                const nb = titleOf(n.notebook_id);
                const href =
                  nb?.kind === "cours"
                    ? `/notes/cours/${n.notebook_id}?seance=${n.id}`
                    : `/notes/${n.id}`;
                const excerpt = n.body
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 160);
                return (
                  <li key={n.id} className="min-w-0">
                    <Link
                      href={href}
                      className="h-full rounded-xl bg-papier border border-noir/8 p-5 flex flex-col gap-2 hover:border-noir/25 transition-colors"
                    >
                      <span className="text-[11px] tracking-[.1em] uppercase text-doux truncate">
                        {nb
                          ? nb.kind === "cours"
                            ? `Cours · ${nb.title}`
                            : nb.title
                          : ""}{" "}
                        · {relativeTime(n.updated_at)}
                      </span>
                      <span className="font-serif text-[22px] leading-tight">
                        {n.title}
                      </span>
                      {excerpt && (
                        <span className="text-sm text-encre/80 line-clamp-2 leading-normal">
                          {excerpt}
                        </span>
                      )}
                      {n.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1 mt-auto pt-1">
                          {n.tags.slice(0, 4).map((t) => (
                            <span key={t} className="text-xs text-doux">
                              #{t}
                            </span>
                          ))}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {notebook && notebook.owner_id === data.userId && (
            <details className="mt-6 text-sm text-doux">
              <summary className="cursor-pointer hover:text-noir w-fit">
                Supprimer ce carnet
              </summary>
              <form
                action={deleteNotebook}
                className="mt-3 flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="notebookId" value={notebook.id} />
                <input type="hidden" name="confirm" value="oui" />
                <span>
                  Le carnet et ses {notebook.notes} note
                  {notebook.notes > 1 ? "s" : ""} seront supprimés
                  définitivement.
                </span>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-full border border-terre text-terre text-sm"
                >
                  Supprimer définitivement
                </button>
              </form>
            </details>
          )}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
