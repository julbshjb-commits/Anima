import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { REPORT_REASONS } from "@anima/core";
import { getMe, moderationQueue } from "@/lib/reseau";
import { relativeTime } from "@/lib/format";
import { moderate } from "../decouvrir/actions";

export const metadata: Metadata = { title: "Modération" };

export default function ModerationPage() {
  return (
    <main className="max-w-3xl px-5 py-8 lg:px-12 lg:pt-10 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="surtitre">Équipe Anima</p>
        <h1 className="titre text-[44px] leading-[1.05]">Modération</h1>
      </div>
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

const KIND = { post: "Publication", comment: "Commentaire", profile: "Profil" } as const;

async function Queue() {
  const { isAdmin } = await getMe();
  if (!isAdmin) notFound();
  const items = await moderationQueue();
  if (!items.length) return <p className="text-doux">Aucun signalement en attente. 🌿</p>;
  return (
    <ul className="flex flex-col gap-4">
      {items.map((g) => (
        <li key={`${g.kind}:${g.id}`} className="rounded-2xl bg-papier border border-trait p-5 flex flex-col gap-3">
          <p className="text-xs text-doux">
            {KIND[g.kind]} de @{g.content?.author ?? "?"} · signalé {relativeTime(g.first)}
            {g.content?.hidden && " · déjà masqué"}
          </p>
          <p className="whitespace-pre-wrap break-words">{g.content?.body || <i className="text-doux">(contenu supprimé)</i>}</p>
          <p className="flex flex-wrap gap-1.5">
            {Object.entries(g.reasons).map(([r, n]) => (
              <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-terre/15 text-terre">
                {REPORT_REASONS[r as keyof typeof REPORT_REASONS]} × {n}
              </span>
            ))}
          </p>
          {g.details.length > 0 && <p className="text-sm text-doux">« {g.details.join(" » · « ")} »</p>}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["garde", "Rien à signaler, garder"],
                ["retire", g.kind === "profile" ? "Suspendre le profil" : "Retirer"],
                ...(g.kind === "profile" ? [] : [["suspendu", "Retirer et suspendre l'auteur"]]),
              ] as [string, string][]
            ).map(([a, l]) => (
              <form key={a} action={moderate}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="kind" value={g.kind} />
                <input type="hidden" name="action" value={a} />
                <button className={`h-9 px-4 rounded-full text-sm border border-trait ${a === "garde" ? "" : "text-terre"}`}>{l}</button>
              </form>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
