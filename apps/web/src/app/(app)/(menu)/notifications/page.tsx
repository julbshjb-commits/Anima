import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getNotifications } from "@/lib/reseau";
import { relativeTime } from "@/lib/format";
import { ProfilePic } from "@/components/social/ProfilePic";
import { acceptFollower, follow, markNotificationsRead, removeFollower } from "../decouvrir/actions";

export const metadata: Metadata = { title: "Notifications" };

const TEXT = {
  follow: "s'est abonné·e à toi",
  follow_request: "demande à te suivre",
  follow_accepted: "a accepté ta demande",
  like: "a aimé ta publication",
  comment: "a commenté ta publication",
} as const;

export default function NotificationsPage() {
  return (
    <main className="px-4 sm:px-6 py-6 lg:px-10 lg:pt-10 flex justify-center">
      <div className="w-full max-w-[640px] flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="surtitre">Le réseau Anima</p>
            <h1 className="titre text-[40px] sm:text-[48px] leading-[1.02]">Notifications</h1>
          </div>
          <form action={markNotificationsRead}>
            <button className="text-sm text-doux underline underline-offset-4 hover:text-noir">Tout marquer comme lu</button>
          </form>
        </div>
        <Suspense fallback={<p className="text-doux">Chargement…</p>}>
          <List />
        </Suspense>
      </div>
    </main>
  );
}

async function List() {
  const rows = await getNotifications();
  if (!rows.length)
    return (
      <div className="rounded-[28px] border border-dashed border-trait p-10 text-center">
        <p className="titre text-2xl">Tout est calme.</p>
        <p className="text-sm text-doux mt-2">Les j&apos;aime, commentaires et nouveaux abonnés arriveront ici.</p>
      </div>
    );
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((n, i) => (
        <li
          key={n.id}
          className={`relative flex items-center gap-3.5 p-3.5 rounded-2xl transition-colors animate-monte ${n.read_at ? "hover:bg-lin" : "bg-papier border border-trait"}`}
          style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
        >
          {!n.read_at && <span aria-label="Non lue" className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-champagne" />}
          <Link href={`/u/${n.actor.handle}`}>
            <ProfilePic name={n.actor.name} handle={n.actor.handle} src={n.actor.avatar} size={44} />
          </Link>
          <Link href={n.post_id ? `/p/${n.post_id}` : `/u/${n.actor.handle}`} className="flex-1 min-w-0">
            <p className="text-[15px] leading-snug">
              <b className="font-medium">{n.actor.name}</b> {TEXT[n.kind]}
              <span className="text-doux"> · {relativeTime(n.created_at)}</span>
            </p>
            {n.excerpt && <p className="text-sm text-doux truncate">« {n.excerpt} »</p>}
          </Link>
          {n.kind === "follow_request" ? (
            <div className="flex gap-1.5">
              <form action={acceptFollower}>
                <input type="hidden" name="id" value={n.actor_id} />
                <button className="h-9 px-4 rounded-full bg-noir text-casse text-sm font-semibold">Accepter</button>
              </form>
              <form action={removeFollower}>
                <input type="hidden" name="id" value={n.actor_id} />
                <button className="h-9 px-4 rounded-full border border-trait text-sm">Refuser</button>
              </form>
            </div>
          ) : n.kind === "follow" && !n.following ? (
            <form action={follow}>
              <input type="hidden" name="id" value={n.actor_id} />
              <button className="h-9 px-4 rounded-full bg-noir text-casse text-sm font-semibold">Suivre en retour</button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
