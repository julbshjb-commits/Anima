import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { fileType, formatLongDate } from "@anima/core";
import { getNote, getNotesHome } from "@/lib/notes";
import { relativeTime } from "@/lib/format";
import { IconCoche } from "@/components/icons";
import { deleteNote, toggleNoteTask } from "../actions";
import { NoteEditor, TaskFromNote } from "../Forms";
import { NotesSidebar } from "../NotesSidebar";

export const metadata: Metadata = { title: "Note" };

export default function NotePage(props: PageProps<"/notes/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <NoteView {...props} />
    </Suspense>
  );
}

async function NoteView({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getNote(id);
  if (!detail) notFound();
  const { note, notebook, tasks, files, canEdit } = detail;
  if (notebook.kind === "cours")
    redirect(`/notes/cours/${notebook.id}?seance=${note.id}`);
  const home = await getNotesHome({ notebookId: notebook.id });

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <div className="hidden lg:contents">
        <NotesSidebar data={home} notebookId={notebook.id} />
      </div>
      <main className="flex-1 min-w-0 px-5 py-6 lg:px-10 lg:py-7 flex flex-col gap-4">
        <nav className="flex items-center gap-2 text-[13px] text-doux">
          <Link href="/notes" className="hover:text-noir lg:hidden">
            Notes
          </Link>
          <span className="lg:hidden">/</span>
          <Link
            href={`/notes?carnet=${notebook.id}`}
            className="hover:text-noir"
          >
            {notebook.title}
          </Link>
          <span>· modifiée {relativeTime(note.updated_at)}</span>
        </nav>
        <NoteEditor
          id={note.id}
          title={note.title}
          body={note.body}
          tags={note.tags}
          readOnly={!canEdit}
        />
      </main>

      <aside
        aria-label="La marge"
        className="xl:w-[300px] shrink-0 px-5 py-6 xl:py-7 border-t xl:border-t-0 xl:border-l border-trait bg-lin/40 flex flex-col gap-6 xl:sticky xl:top-0 xl:h-dvh xl:overflow-y-auto"
      >
        <div className="flex flex-col gap-1">
          <h2 className="titre text-[26px] leading-none">La marge</h2>
          <p className="text-[13px] text-doux leading-normal">
            Ce que cette page touche ailleurs dans Anima.
          </p>
        </div>

        <section className="flex flex-col gap-2.5">
          <h3 className="surtitre">Né de cette page</h3>
          {tasks.map((t) => (
            <form
              key={t.id}
              action={toggleNoteTask}
              className="rounded-xl bg-papier border border-noir/8 p-3.5 flex gap-3 items-start"
            >
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
              <input type="hidden" name="path" value={`/notes/${note.id}`} />
              <button
                type="submit"
                aria-label={
                  t.done_at ? "Rouvrir la tâche" : "Marquer comme faite"
                }
                className={`w-8 h-8 shrink-0 rounded-lg grid place-items-center ${t.done_at ? "bg-sauge text-casse" : "bg-noir text-casse"}`}
              >
                <IconCoche size={16} />
              </button>
              <span className="flex flex-col min-w-0">
                <span className="text-[11px] tracking-[.1em] uppercase text-doux">
                  Tâche · M'organiser
                </span>
                <span
                  className={`text-sm font-medium ${t.done_at ? "line-through text-doux" : ""}`}
                >
                  {t.title}
                </span>
                {t.due_date && (
                  <span className="text-xs text-doux">
                    {formatLongDate(t.due_date)}
                    {t.due_time
                      ? ` · ${t.due_time.slice(0, 5).replace(":", " h ")}`
                      : ""}
                  </span>
                )}
              </span>
            </form>
          ))}
          <TaskFromNote noteId={note.id} path={`/notes/${note.id}`} />
          <p className="text-xs text-doux leading-normal">
            Écris « revoir le graphique vendredi 18 h » : la tâche arrive dans
            M'organiser, au bon jour.
          </p>
        </section>

        {files.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="surtitre">Fichiers liés</h3>
            {files.map((f) => (
              <a
                key={f.id}
                href={`/fichiers/ouvrir/${f.id}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2.5 text-sm hover:underline underline-offset-4 min-w-0"
              >
                <span
                  aria-hidden
                  className="w-6 h-6 rounded grid place-items-center text-[8px] font-semibold text-blanc shrink-0"
                  style={{ background: fileType(f.mime_type).color }}
                >
                  {fileType(f.mime_type).badge}
                </span>
                <span className="truncate">{f.name}</span>
              </a>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="surtitre">Carnet</h3>
          <p className="text-sm">
            {notebook.title}{" "}
            <span className="text-doux">· visible par toi seul</span>
          </p>
          <p className="text-xs text-doux">
            Créée {relativeTime(note.created_at)}
          </p>
        </section>

        {canEdit && (
          <details className="mt-auto text-sm text-doux">
            <summary className="cursor-pointer hover:text-noir w-fit">
              Supprimer la note
            </summary>
            <form action={deleteNote} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={note.id} />
              <input type="hidden" name="notebookId" value={notebook.id} />
              <span className="text-xs">
                Suppression définitive. Les tâches nées de cette note restent
                dans M'organiser.
              </span>
              <button
                type="submit"
                className="self-start h-9 px-4 rounded-full border border-terre text-terre text-sm"
              >
                Supprimer
              </button>
            </form>
          </details>
        )}
      </aside>
    </div>
  );
}
