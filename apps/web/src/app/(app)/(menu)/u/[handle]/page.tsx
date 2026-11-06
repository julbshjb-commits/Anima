import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { compactCount } from "@anima/core";
import { getProfile } from "@/lib/reseau";
import { PostCard } from "@/components/social/PostCard";
import { ProfilePic } from "@/components/social/ProfilePic";
import { ContentMenu } from "@/components/social/Client";
import { IconCadenas, IconRetour } from "@/components/icons";
import { btn, btnGhost } from "@/components/ui";
import { follow, unblock, unfollow } from "../../decouvrir/actions";

export const metadata: Metadata = { title: "Profil" };

export default function UserPage(props: PageProps<"/u/[handle]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <User {...props} />
    </Suspense>
  );
}

async function User({ params }: PageProps<"/u/[handle]">) {
  const { handle } = await params;
  const data = await getProfile(decodeURIComponent(handle).replace(/^@/, ""));
  if (!data.profile) notFound();
  const { profile: p, isMe, relation, canSeePosts, posts, user } = data;

  return (
    <main className="px-4 sm:px-6 py-6 lg:px-10 lg:pt-10 flex justify-center">
      <div className="w-full max-w-[640px] flex flex-col gap-6">
        <Link href="/decouvrir" className="inline-flex items-center gap-1.5 text-sm text-doux hover:text-noir self-start">
          <IconRetour size={16} /> Découvrir
        </Link>

        <section className="relative isolate overflow-hidden rounded-[32px] bg-[#111112] border border-trait p-6 sm:p-8 flex flex-col gap-5">
          <div className="halo opacity-60" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <div className="voile" aria-hidden />
          <div className="relative flex items-start gap-5">
            <ProfilePic name={p.name} handle={p.handle} src={p.avatar} size={96} ring />
            <div className="flex-1 min-w-0 flex flex-col gap-1 pt-2">
              <h1 className="titre text-[32px] sm:text-[38px] leading-[1.05] text-blanc break-words flex items-center gap-2">
                {p.name}
                {p.is_private && <IconCadenas size={18} className="text-blanc/60" />}
              </h1>
              <p className="text-blanc/70">
                @{p.handle}
                {relation.followsMe && !isMe && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-blanc/10">te suit</span>}
              </p>
            </div>
            {!isMe && <ContentMenu kind="profile" targetId={p.id} authorId={p.id} authorHandle={p.handle} mine={false} />}
          </div>
          {p.bio && <p className="relative text-blanc/90 text-[16px] leading-relaxed whitespace-pre-wrap">{p.bio}</p>}
          <dl className="relative flex gap-8 text-blanc">
            {(
              [
                [p.posts_count, "publications"],
                [p.followers_count, "abonnés"],
                [p.following_count, "abonnements"],
              ] as const
            ).map(([n, l]) => (
              <div key={l} className="flex flex-col">
                <dt className="sr-only">{l}</dt>
                <dd className="titre text-[26px] leading-none tabular-nums">{compactCount(n)}</dd>
                <span className="text-xs text-blanc/60 mt-1">{l}</span>
              </div>
            ))}
          </dl>
          <div className="relative">
            {isMe ? (
              <Link href="/decouvrir/profil" className={`${btnGhost} !text-blanc`}>
                Modifier mon profil
              </Link>
            ) : relation.blocked ? (
              <form action={unblock}>
                <input type="hidden" name="id" value={p.id} />
                <button className={btnGhost}>Débloquer</button>
              </form>
            ) : relation.following ? (
              <form action={unfollow}>
                <input type="hidden" name="id" value={p.id} />
                <button className={`${btnGhost} !text-blanc`}>{relation.following === "pending" ? "Demande envoyée · annuler" : "Abonné·e ✓"}</button>
              </form>
            ) : (
              <form action={follow}>
                <input type="hidden" name="id" value={p.id} />
                <button className={btn}>{p.is_private ? "Demander à suivre" : relation.followsMe ? "Suivre en retour" : "Suivre"}</button>
              </form>
            )}
          </div>
        </section>

        {!canSeePosts ? (
          <div className="rounded-[28px] border border-dashed border-trait p-10 text-center flex flex-col gap-2 items-center">
            <IconCadenas size={22} className="text-doux" />
            <p className="titre text-2xl">Ce compte est privé.</p>
            <p className="text-sm text-doux">Abonne-toi pour voir ses publications, si @{p.handle} accepte.</p>
          </div>
        ) : posts.length ? (
          <div className="flex flex-col gap-4">
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} me={user.id} index={i} />
            ))}
          </div>
        ) : (
          <p className="text-center text-doux py-10">{isMe ? "Tu n'as encore rien publié." : "Rien de publié pour l'instant."}</p>
        )}
      </div>
    </main>
  );
}
