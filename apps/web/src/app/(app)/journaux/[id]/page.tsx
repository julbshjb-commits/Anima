import Link from "next/link";
import { Suspense } from "react";
import { MOOD_META, formatLongDate, toIsoDate } from "@anima/core";
import { getJournal, getMonthEntries } from "@/lib/data";
import { MONTHS, parseMonth } from "@/lib/format";
import { IconCrayon } from "@/components/icons";
import { btn, btnGhost, card } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { JournalFrame, authorName, membersLabel } from "./JournalFrame";
import { LiveRefresh } from "./LiveRefresh";

export default function JournalPage(props: PageProps<"/journaux/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Ouverture du journal…</p>}>
      <Journal {...props} />
    </Suspense>
  );
}

async function Journal({ params, searchParams }: PageProps<"/journaux/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { journal, members, myRole, user } = await getJournal(id);
  const { y, m } = parseMonth(sp.mois);
  const entries = await getMonthEntries(journal.id, toIsoDate(new Date(y, m, 1)), toIsoDate(new Date(y, m + 1, 0)));
  const today = toIsoDate(new Date());
  const isIntime = journal.kind === "intime";
  const canWrite = myRole !== "reader";
  const writeHref = `/journaux/${journal.id}/ecrire?date=${today}`;

  return (
    <JournalFrame journal={journal} members={members} userId={user.id} canWrite={canWrite} year={y} month={m} entries={entries}>
      {!isIntime && <LiveRefresh journalId={journal.id} />}
      <main className="flex-1 px-5 pt-6 pb-28 lg:px-12 lg:pb-12 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-doux">
            {isIntime ? "Visible par toi seul" : `Partagé avec ${membersLabel(members, user.id)} · chacun lit les entrées des autres`}
          </span>
          <span className="flex gap-2.5">
            {!isIntime && canWrite && (
              <Link href={`/journaux/${journal.id}/inviter`} className={`${btnGhost} h-10 xl:hidden`}>
                Inviter
              </Link>
            )}
            {canWrite && (
              <Link href={writeHref} className={`${btn} h-10 max-lg:hidden`}>
                <IconCrayon size={16} />
                Écrire l'entrée d'aujourd'hui
              </Link>
            )}
          </span>
        </div>

        {typeof sp.photos === "string" && (
          <p role="alert" className="text-sm text-terre">
            L'entrée est enregistrée, mais {sp.photos === "1" ? "une photo n'a" : `${sp.photos} photos n'ont`} pas pu être
            envoyée{sp.photos === "1" ? "" : "s"}. Vérifie ta connexion et réessaie plus tard.
          </p>
        )}

        <div className="w-full max-w-[720px] mx-auto flex flex-col gap-5">
          {entries.length === 0 ? (
            <div className="py-10 flex flex-col gap-3">
              <p className="surtitre">
                {MONTHS[m]} {y}
              </p>
              <h1 className="titre text-[44px] leading-[1.05]">Page blanche.</h1>
              <p className="font-serif text-xl leading-[1.65] text-encre">
                Aucune entrée ce mois-ci. La première ligne est souvent la plus simple : comment s'est passée ta journée ?
              </p>
            </div>
          ) : (
            entries.map((e) => (
              <article
                key={e.id}
                id={e.entry_date}
                className={`${card} scroll-mt-6 p-6 sm:p-8 flex flex-col gap-4 transition-transform duration-300 hover:-translate-y-0.5`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {!isIntime && <Avatar name={members.find((m) => m.id === e.author_id)?.display_name ?? "?"} index={Math.max(0, members.findIndex((m) => m.id === e.author_id))} size={28} />}
                  <span className="surtitre">
                    {formatLongDate(e.entry_date)}
                    {!isIntime && ` · ${authorName(e.author_id, members, user.id)}`}
                  </span>
                  {e.mood && (
                    <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-xs font-medium text-noir" style={{ background: `${MOOD_META[e.mood].color}40` }}>
                      <i className="w-2 h-2 rounded-full" style={{ background: MOOD_META[e.mood].color }} />
                      {MOOD_META[e.mood].label}
                    </span>
                  )}
                  {canWrite && e.author_id === user.id && (
                    <Link href={`/journaux/${journal.id}/entree/${e.id}`} className="ml-auto text-[13px] text-doux hover:text-noir underline-offset-4 hover:underline">
                      Modifier
                    </Link>
                  )}
                </div>
                {e.title && <h2 className="titre text-[36px] leading-[1.1]">{e.title}</h2>}
                <p className="font-serif text-xl leading-[1.65] text-encre whitespace-pre-wrap">{e.content_text}</p>
                {e.photos.length > 0 && (
                  <div className={`grid gap-5 py-2 ${e.photos.length > 1 ? "grid-cols-2" : "max-w-[460px]"}`}>
                    {e.photos.map((p, i) => (
                      // Photos en polaroïd, légèrement penchées ; elles se redressent au survol.
                      <span
                        key={p.id}
                        className={`block bg-[#fffdf8] p-2 pb-8 rounded-[4px] shadow-[0_14px_30px_-14px_rgba(0,0,0,.45)] transition-transform duration-500 ease-[cubic-bezier(.3,1.6,.5,1)] hover:rotate-0 hover:scale-[1.02] ${i % 2 ? "rotate-[1.8deg]" : "-rotate-[2.2deg]"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire, pas d'optimisation possible */}
                        <img src={p.url} alt="" className="w-full max-h-[420px] rounded-[2px] object-cover bg-ivoire" />
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </main>

      {canWrite && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-fond via-fond/90 to-transparent">
          <Link href={writeHref} className={`${btn} w-full h-[52px] text-[15px]`}>
            <IconCrayon size={18} />
            Écrire l'entrée d'aujourd'hui
          </Link>
        </div>
      )}
    </JournalFrame>
  );
}
