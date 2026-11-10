import Link from "next/link";
import { coverOf } from "@anima/core";
import { Cover } from "@/components/Cover";
import { IconPlus, IconRetour } from "@/components/icons";
import type { NotesHome } from "@/lib/notes";
import { createNote } from "./actions";
import { NewNotebook } from "./Forms";

const item = "flex items-center gap-3 h-10 px-2.5 rounded-lg text-sm";
const off = "text-encre hover:bg-lin";

/** Barre latérale de la maquette Notes : nouvelle note, carnets, carnets de cours, tags. */
export function NotesSidebar({
  data,
  notebookId,
  tag,
}: {
  data: NotesHome;
  notebookId?: string | null;
  tag?: string | null;
}) {
  const perso = data.notebooks.filter((n) => n.kind === "perso");
  const cours = data.notebooks.filter((n) => n.kind === "cours");
  const target = perso.find((n) => n.id === notebookId) ?? perso[0];
  return (
    <aside className="lg:w-[260px] shrink-0 px-5 py-5 lg:py-7 border-b lg:border-b-0 lg:border-r border-trait flex flex-col gap-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
      <div className="flex items-center gap-2.5">
        <Link
          href="/flashcards"
          aria-label="Retour à l'accueil"
          className="w-9 h-9 shrink-0 rounded-full border border-noir/12 grid place-items-center hover:bg-lin"
        >
          <IconRetour size={16} />
        </Link>
        <Link href="/notes" className="titre text-[26px] leading-none">
          Notes
        </Link>
      </div>

      {target ? (
        <form action={createNote}>
          <input type="hidden" name="notebookId" value={target.id} />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-noir text-casse text-sm font-medium"
          >
            <IconPlus size={16} />
            Nouvelle note
          </button>
        </form>
      ) : (
        <NewNotebook dark />
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="surtitre">Carnets</h2>
        {perso.length > 0 ? (
          <div className="grid grid-cols-5 lg:grid-cols-3 gap-2.5">
            {perso.map((n) => (
              <Link
                key={n.id}
                href={`/notes?carnet=${n.id}`}
                aria-current={notebookId === n.id ? "page" : undefined}
                className="group flex flex-col gap-1.5 min-w-0"
              >
                <span
                  className={`rounded-[6px] ${notebookId === n.id ? "ring-2 ring-noir ring-offset-2 ring-offset-fond" : ""}`}
                >
                  <Cover cover={n.cover} />
                </span>
                <span className="text-xs truncate group-hover:underline">
                  {n.title}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-doux leading-normal">
            Un carnet par matière ou par envie. Ils ne sont visibles que par
            toi.
          </p>
        )}
        {perso.length > 0 && <NewNotebook />}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="surtitre mb-1.5">Notes de cours partagées</h2>
        {cours.map((n) => (
          <Link
            key={n.id}
            href={`/notes/cours/${n.id}`}
            className={`${item} ${off}`}
          >
            <i
              className="w-2.5 h-3.5 rounded-[2px] shrink-0"
              style={{ background: coverOf(n.cover).bg }}
            />
            <span className="flex-1 truncate">{n.title}</span>
            <span className="text-xs text-doux">{n.members}</span>
          </Link>
        ))}
        {cours.length === 0 && (
          <p className="text-xs text-doux leading-normal mb-1.5">
            Prends le cours à plusieurs : chacun ajoute ce qu'il a noté, signé
            de son initiale.
          </p>
        )}
        <NewNotebook defaultKind="cours" />
      </section>

      {data.tags.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="surtitre">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.slice(0, 16).map(({ tag: t }) => (
              <Link
                key={t}
                href={
                  tag === t ? "/notes" : `/notes?tag=${encodeURIComponent(t)}`
                }
                aria-current={tag === t ? "page" : undefined}
                className={`h-8 px-3 grid place-items-center rounded-full border text-[13px] ${tag === t ? "bg-noir border-noir text-casse" : "border-noir/12 hover:border-noir/30"}`}
              >
                #{t}
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
