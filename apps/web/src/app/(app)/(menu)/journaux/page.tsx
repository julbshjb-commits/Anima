import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JOURNAL_KIND_LABELS } from "@anima/core";
import { listMyJournals, type JournalCard } from "@/lib/data";
import { relativeTime } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { AvatarStack } from "@/components/Avatar";
import { IconCadenas, IconPlus } from "@/components/icons";
import { btn, btnGhost } from "@/components/ui";
import { createIntimeJournal } from "./actions";

export const metadata: Metadata = { title: "Journaux" };

const VUES = [
  { id: "tous", label: "Tous" },
  { id: "partages", label: "Partagés" },
  { id: "personnels", label: "Personnels" },
] as const;
type Vue = (typeof VUES)[number]["id"];

export default function JournauxPage(props: PageProps<"/journaux">) {
  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 lg:pb-14 flex flex-col gap-7">
      <Suspense fallback={<p className="text-doux">Chargement de tes journaux…</p>}>
        <Journaux {...props} />
      </Suspense>
    </main>
  );
}

async function Journaux({ searchParams }: PageProps<"/journaux">) {
  const sp = await searchParams;
  const vue: Vue = VUES.some((v) => v.id === sp.vue) ? (sp.vue as Vue) : "tous";
  const { intime, shared, userId } = await listMyJournals();

  // « Partagé » = au moins une autre personne ; un journal créé seul reste personnel.
  const visible = shared.filter((j) =>
    vue === "tous" ? true : vue === "partages" ? j.members.length > 1 : j.members.length <= 1,
  );
  const count = shared.length + (intime ? 1 : 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="surtitre">
            {count} journa{count > 1 ? "ux" : "l"}
            {intime ? " · 1 intime" : ""}
          </p>
          <h1 className="titre text-[44px] leading-[1.05]">Journaux</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/rejoindre" className={btnGhost}>
            Rejoindre avec un code
          </Link>
          <Link href="/journaux/nouveau" className={btn}>
            <IconPlus size={16} />
            Nouveau journal
          </Link>
        </div>
      </header>

      <nav aria-label="Filtrer les journaux" className="flex gap-1 border-b border-noir/12 overflow-x-auto">
        {VUES.map((v) => (
          <Link
            key={v.id}
            href={v.id === "tous" ? "/journaux" : `/journaux?vue=${v.id}`}
            aria-current={vue === v.id ? "page" : undefined}
            className={`h-11 px-3.5 -mb-px flex items-center text-sm whitespace-nowrap ${
              vue === v.id ? "border-b-2 border-noir font-medium" : "text-doux hover:text-noir"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {vue !== "partages" &&
        (intime ? (
          <Link
            href={`/journaux/${intime.id}`}
            className="flex flex-wrap items-center gap-5 rounded-xl bg-anthracite text-blanc px-6 py-5 border border-trait hover:bg-ivoire transition-colors"
          >
            <IntimeLock />
            <span className="flex-1 min-w-52 flex flex-col gap-1">
              <span className="titre text-[26px] leading-tight">Mon journal intime</span>
              <span className="text-[13px] text-gris-clair">
                Visible par toi seul ·{" "}
                {intime.last ? `dernière entrée ${relativeTime(intime.last.created_at)}` : "pas encore d'entrée"}
              </span>
            </span>
            <span className="inline-flex items-center h-10 px-[18px] rounded-full border border-blanc/25 text-sm">Ouvrir</span>
          </Link>
        ) : (
          <form action={createIntimeJournal} className="flex flex-wrap items-center gap-5 rounded-xl bg-anthracite text-blanc px-6 py-5">
            <IntimeLock />
            <span className="flex-1 min-w-52 flex flex-col gap-1">
              <span className="titre text-[26px] leading-tight">Ton journal intime</span>
              <span className="text-[13px] text-gris-clair">
                Personne d'autre ne peut le lire, et il ne se partage jamais. Aucune IA n'y a accès.
              </span>
            </span>
            <button type="submit" className="inline-flex items-center h-10 px-[18px] rounded-full bg-blanc text-nuit text-sm font-medium">
              Le créer
            </button>
          </form>
        ))}

      <ul className="grid gap-x-7 gap-y-8 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
        {visible.map((j) => (
          <li key={j.id}>
            <JournalTile j={j} me={userId} />
          </li>
        ))}
        <li>
          <Link
            href="/journaux/nouveau"
            className="aspect-[3/4] rounded-xl border-[1.5px] border-dashed border-noir/25 flex flex-col items-center justify-center gap-2.5 px-5 text-center text-doux hover:border-noir/50 hover:text-noir transition-colors"
          >
            <IconPlus size={28} />
            <span className="text-sm font-medium">Créer un journal</span>
            <span className="text-xs">10 types : couple, amis, famille, voyage, rêves…</span>
          </Link>
        </li>
      </ul>
    </>
  );
}

function IntimeLock() {
  return (
    <span className="w-12 h-12 shrink-0 rounded-full border border-sable/50 grid place-items-center text-sable">
      <IconCadenas size={20} />
    </span>
  );
}

function JournalTile({ j, me }: { j: JournalCard; me: string }) {
  const others = j.members.length;
  const author = j.last && (j.last.author_id === me ? "toi" : j.members.find((m) => m.id === j.last?.author_id)?.display_name);
  const activity = j.last ? `${others > 1 && author ? `${author}, ` : ""}${relativeTime(j.last.created_at)}` : "aucune entrée";
  return (
    <Link href={`/journaux/${j.id}`} className="group flex flex-col gap-3">
      <Cover cover={j.cover} title={j.title} kind={j.kind} className="transition-transform group-hover:-translate-y-0.5" />
      <span className="flex items-start justify-between gap-2">
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[15px] font-medium line-clamp-2">{j.title}</span>
          <span className="text-[13px] text-doux line-clamp-2">
            {JOURNAL_KIND_LABELS[j.kind]} · {activity}
          </span>
        </span>
        {others <= 1 ? (
          <span className="text-xs text-doux shrink-0">Solo</span>
        ) : others > 3 ? (
          <span className="text-xs text-doux shrink-0">{others} membres</span>
        ) : (
          <AvatarStack names={j.members.map((m) => m.display_name)} />
        )}
      </span>
    </Link>
  );
}
