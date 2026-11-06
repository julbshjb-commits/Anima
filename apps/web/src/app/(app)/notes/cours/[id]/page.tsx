import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fileType, formatBytes, formatLongDate, isImage, parseIsoDate, todayIn } from "@anima/core";
import { getCours, type CoursData } from "@/lib/notes";
import { MONTHS } from "@/lib/format";
import { initial } from "@/components/Avatar";
import { IconCheck, IconRetour } from "@/components/icons";
import { RichText } from "../../RichText";
import {
  deleteBlock,
  deleteNotebook,
  leaveNotebook,
  toggleNoteTask,
  toggleQuestion,
} from "../../actions";
import {
  AddBlock,
  CopySeance,
  EditBlock,
  InviteToNotebook,
  NewSeance,
  TaskFromNote,
} from "../../Forms";
import { LiveSeance, PrintButton } from "./Live";

export const metadata: Metadata = { title: "Carnet de cours" };

/** Couleurs des membres, dans l'ordre d'arrivée (pastille et filet du passage). */
const TONES = [
  { chip: "bg-ivoire text-noir", line: "#CFC6B8" },
  { chip: "bg-[#D9A79B] text-nuit", line: "#D9A79B" },
  { chip: "bg-noir text-casse", line: "#151515" },
  { chip: "bg-[#7E8FA3] text-blanc", line: "#7E8FA3" },
  { chip: "bg-sauge text-blanc", line: "#8A9A7B" },
  { chip: "bg-[#C79A4B] text-nuit", line: "#C79A4B" },
];

export default function CoursPage(props: PageProps<"/notes/cours/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Cours {...props} />
    </Suspense>
  );
}

const shortDate = (iso: string | null) => {
  if (!iso) return "";
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
};

async function Cours({ params, searchParams }: PageProps<"/notes/cours/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const seanceId =
    typeof sp.seance === "string" && /^[0-9a-f-]{36}$/i.test(sp.seance)
      ? sp.seance
      : null;
  const data = await getCours(id, seanceId);
  if (!data) notFound();
  const { notebook, members, current, seances } = data;
  const today = todayIn();
  const tone = (userId: string) =>
    TONES[
      Math.max(
        0,
        members.findIndex((m) => m.id === userId),
      ) % TONES.length
    ];
  const name = (userId: string) =>
    userId === data.userId ? "Toi" : (data.names[userId] ?? "Ancien membre");
  const isOwner = notebook.owner_id === data.userId;

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <LiveSeance notebookId={notebook.id} />
      {/* Séances */}
      <aside className="lg:w-[280px] shrink-0 px-5 py-5 lg:py-7 border-b lg:border-b-0 lg:border-r border-trait flex flex-col gap-5 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto print:hidden">
        <div className="flex items-center gap-2.5">
          <Link
            href="/notes"
            aria-label="Retour aux notes"
            className="w-9 h-9 shrink-0 rounded-full border border-noir/12 grid place-items-center hover:bg-lin"
          >
            <IconRetour size={16} />
          </Link>
          <span className="surtitre leading-tight">
            Carnet de cours partagé
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="titre text-[32px] leading-[1.05]">{notebook.title}</h1>
          <p className="text-[13px] text-doux">
            {notebook.subtitle ? `${notebook.subtitle} · ` : ""}
            {members.length} membre{members.length > 1 ? "s" : ""}
          </p>
        </div>
        {seances.length > 0 && (
          <Link
            href={`/notes/cours/${notebook.id}/fiche`}
            className="rounded-xl bg-noir text-casse px-4 py-3 flex flex-col"
          >
            <span className="text-sm font-medium">Fiche de révision</span>
            <span className="text-xs text-casse/65">
              Rassemble{" "}
              {seances.length > 1
                ? `les ${seances.length} séances`
                : "la séance"}
            </span>
          </Link>
        )}
        <section className="flex flex-col gap-1 min-w-0">
          <h2 className="surtitre mb-1.5">Séances</h2>
          <div className="flex lg:flex-col gap-1 max-lg:overflow-x-auto max-lg:-mx-5 max-lg:px-5 max-lg:pb-1">
            {seances.map((s, i) => {
              const on = current?.id === s.id;
              return (
                <Link
                  key={s.id}
                  href={`/notes/cours/${notebook.id}?seance=${s.id}`}
                  aria-current={on ? "page" : undefined}
                  className={`max-lg:shrink-0 max-lg:w-[220px] rounded-xl px-3 py-2.5 flex flex-col gap-0.5 ${on ? "bg-papier shadow-[0_0_0_1px_var(--trait)]" : "hover:bg-lin"}`}
                >
                  <span className="text-sm leading-snug">
                    {seances.length - i} · {s.title}
                  </span>
                  <span className="text-xs text-doux">
                    {s.session_date === today
                      ? "Aujourd'hui"
                      : shortDate(s.session_date)}{" "}
                    ·{" "}
                    {s.authors === 0
                      ? "vide"
                      : `${s.authors} auteur${s.authors > 1 ? "s" : ""}`}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="mt-2">
            <NewSeance notebookId={notebook.id} today={today} />
          </div>
        </section>
      </aside>

      {/* Séance */}
      <main className="flex-1 min-w-0 px-5 py-6 lg:px-12 lg:py-7 flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex">
              {members.slice(0, 4).map((m, i) => (
                <span
                  key={m.id}
                  title={m.name}
                  className={`w-8 h-8 rounded-full border-2 border-fond grid place-items-center text-xs font-semibold ${tone(m.id).chip} ${i ? "-ml-2" : ""}`}
                >
                  {initial(m.name)}
                </span>
              ))}
            </span>
            <span className="text-[13px] text-doux">
              Les ajouts de chacun arrivent en direct.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <InviteToNotebook notebookId={notebook.id} title={notebook.title} />
            {current && <PrintButton />}
          </div>
        </div>

        {!current ? (
          <div className="rounded-2xl bg-papier border border-noir/8 p-8 flex flex-col gap-3 max-w-xl">
            <h2 className="titre text-3xl">Première séance</h2>
            <p className="text-doux leading-relaxed">
              Ouvre une séance au début du cours, invite ta promo avec un code,
              et écrivez ensemble. Chaque passage porte l'initiale de qui l'a
              écrit.
            </p>
          </div>
        ) : (
          <article className="max-w-[780px] flex flex-col gap-5">
            <header className="flex flex-col gap-1.5">
              <p className="surtitre">
                Séance {current.number}
                {current.session_date
                  ? ` · ${formatLongDate(current.session_date)} ${current.session_date.slice(0, 4)}`
                  : ""}
              </p>
              <h2 className="titre text-[34px] lg:text-[42px] leading-[1.08]">
                {current.title}
              </h2>
            </header>

            {data.blocks.length === 0 && (
              <p className="text-doux">
                Personne n'a encore écrit. Lance-toi en bas de la page.
              </p>
            )}

            <div className="flex flex-col gap-4">
              {data.blocks.map((b) => {
                const t = tone(b.author_id);
                const mine = b.author_id === data.userId;
                const actions = mine && (
                  <span className="flex items-center gap-3 print:hidden">
                    <EditBlock
                      id={b.id}
                      notebookId={notebook.id}
                      content={b.content}
                    />
                    <form action={deleteBlock}>
                      <input type="hidden" name="id" value={b.id} />
                      <input
                        type="hidden"
                        name="notebookId"
                        value={notebook.id}
                      />
                      <button
                        type="submit"
                        className="text-xs text-doux hover:text-terre"
                      >
                        Supprimer
                      </button>
                    </form>
                  </span>
                );
                if (b.kind === "question")
                  return (
                    <div
                      key={b.id}
                      className="lg:ml-9 rounded-xl bg-ivoire px-4 py-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]"
                    >
                      <span className="font-semibold">
                        Question pour le prof
                      </span>
                      <span className="flex-1 min-w-0">
                        · {b.content}{" "}
                        <span className="text-doux">({name(b.author_id)})</span>
                        {b.done_at && (
                          <span className="ml-2 text-xs text-sauge">posée</span>
                        )}
                      </span>
                      {actions}
                    </div>
                  );
                return (
                  <div key={b.id} className="flex gap-3">
                    <span
                      title={name(b.author_id)}
                      className={`w-6 h-6 mt-0.5 shrink-0 rounded-full grid place-items-center text-[10px] font-semibold ${t.chip}`}
                    >
                      {initial(data.names[b.author_id])}
                    </span>
                    <div
                      className="flex-1 min-w-0 pl-4 border-l-2 flex flex-wrap items-start gap-x-4 gap-y-1"
                      style={{ borderColor: t.line }}
                    >
                      {b.file_id && (
                        <SeanceFile id={b.file_id} files={data.files} />
                      )}
                      {b.content && (
                        <RichText
                          text={b.content}
                          className="basis-full text-[16px] leading-[1.7]"
                        />
                      )}
                      {actions}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="print:hidden">
              <AddBlock userId={data.userId} noteId={current.id} notebookId={notebook.id} />
            </div>
          </article>
        )}
      </main>

      {/* Marge */}
      <aside className="xl:w-[280px] shrink-0 px-5 py-6 xl:py-7 border-t xl:border-t-0 xl:border-l border-trait flex flex-col gap-7 xl:sticky xl:top-0 xl:h-dvh xl:overflow-y-auto print:hidden">
        <Questions data={data} />

        <section className="flex flex-col gap-3">
          <h2 className="surtitre">Membres</h2>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <span
                className={`w-8 h-8 rounded-full grid place-items-center text-xs font-semibold ${tone(m.id).chip}`}
              >
                {initial(m.name)}
              </span>
              <span className="flex-1 text-sm truncate">
                {m.id === data.userId ? "Toi" : m.name}
              </span>
              {m.role === "owner" && (
                <span className="text-xs text-doux">a créé le carnet</span>
              )}
            </div>
          ))}
          <p className="text-xs text-doux leading-normal">
            Un absent retrouve la séance complète, avec qui a écrit quoi.
          </p>
        </section>

        {current && (
          <>
            <section className="flex flex-col gap-2.5">
              <h2 className="surtitre">Né de cette séance</h2>
              {data.tasks.map((t) => (
                <form
                  key={t.id}
                  action={toggleNoteTask}
                  className="flex items-start gap-2.5"
                >
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    type="hidden"
                    name="done"
                    value={t.done_at ? "0" : "1"}
                  />
                  <input
                    type="hidden"
                    name="path"
                    value={`/notes/cours/${notebook.id}`}
                  />
                  <button
                    type="submit"
                    aria-label={
                      t.done_at ? "Rouvrir la tâche" : "Marquer comme faite"
                    }
                    className={`w-6 h-6 shrink-0 rounded-md grid place-items-center ${t.done_at ? "bg-sauge text-blanc" : "border border-noir/25"}`}
                  >
                    {t.done_at && <IconCheck size={14} />}
                  </button>
                  <span
                    className={`text-sm ${t.done_at ? "line-through text-doux" : ""}`}
                  >
                    {t.title}
                  </span>
                </form>
              ))}
              <TaskFromNote
                noteId={current.id}
                path={`/notes/cours/${notebook.id}`}
              />
              <p className="text-xs text-doux">
                Ta tâche reste à toi, dans M'organiser.
              </p>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="surtitre">Dans mes notes</h2>
              <CopySeance noteId={current.id} notebooks={data.persoNotebooks} />
            </section>
          </>
        )}

        <details className="mt-auto text-sm text-doux">
          <summary className="cursor-pointer hover:text-noir w-fit">
            {isOwner ? "Supprimer le carnet" : "Quitter le carnet"}
          </summary>
          <form
            action={isOwner ? deleteNotebook : leaveNotebook}
            className="mt-3 flex flex-col gap-2"
          >
            <input type="hidden" name="notebookId" value={notebook.id} />
            <input type="hidden" name="confirm" value="oui" />
            <span className="text-xs leading-normal">
              {isOwner
                ? "Toutes les séances et les passages de chacun seront supprimés pour tout le monde."
                : "Tes passages restent dans le carnet pour les autres."}
            </span>
            <button
              type="submit"
              className="self-start h-9 px-4 rounded-full border border-terre text-terre text-sm"
            >
              {isOwner ? "Supprimer pour tout le monde" : "Quitter"}
            </button>
          </form>
        </details>
      </aside>
    </div>
  );
}

function Questions({ data }: { data: CoursData }) {
  if (data.questions.length === 0)
    return (
      <section className="flex flex-col gap-2">
        <h2 className="surtitre">Questions à poser</h2>
        <p className="text-xs text-doux leading-normal">
          Pendant la séance, choisis « Question pour le prof » : la question
          atterrit ici, et chacun peut la cocher une fois posée.
        </p>
      </section>
    );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="surtitre">Questions à poser</h2>
      {data.questions.map((q) => (
        <form
          key={q.id}
          action={toggleQuestion}
          className="flex items-start gap-2.5"
        >
          <input type="hidden" name="id" value={q.id} />
          <input type="hidden" name="notebookId" value={data.notebook.id} />
          <button
            type="submit"
            role="checkbox"
            aria-checked={!!q.done_at}
            aria-label={
              q.done_at ? "Marquer comme non posée" : "Marquer comme posée"
            }
            className={`w-5 h-5 mt-0.5 shrink-0 rounded-[5px] grid place-items-center ${q.done_at ? "bg-noir text-casse" : "border border-noir/30"}`}
          >
            {q.done_at && <IconCheck size={13} />}
          </button>
          <span
            className={`text-sm leading-snug ${q.done_at ? "line-through text-doux" : ""}`}
          >
            {q.content}
          </span>
        </form>
      ))}
    </section>
  );
}

function SeanceFile({ id, files }: { id: string; files: CoursData["files"] }) {
  const f = files.get(id);
  if (!f)
    return <p className="basis-full text-[13px] text-doux">Fichier retiré par son autrice.</p>;
  if (isImage(f.mime))
    return (
      <a href={`/fichiers/ouvrir/${id}`} target="_blank" rel="noopener" className="basis-full block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.url} alt={f.name} className="max-h-[360px] rounded-lg bg-lin" />
      </a>
    );
  const t = fileType(f.mime);
  return (
    <a
      href={`/fichiers/ouvrir/${id}`}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-3 rounded-lg border border-noir/10 px-3 py-2 hover:bg-lin max-w-md"
    >
      <span aria-hidden className="w-8 h-8 rounded grid place-items-center text-[9px] font-semibold text-blanc shrink-0" style={{ background: t.color }}>
        {t.badge}
      </span>
      <span className="min-w-0 flex flex-col">
        <span className="text-sm truncate">{f.name}</span>
        <span className="text-xs text-doux">{formatBytes(f.size)}</span>
      </span>
    </a>
  );
}
