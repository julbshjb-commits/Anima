import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MOOD_META, parseIsoDate } from "@anima/core";
import { getCercles, type CerclesData } from "@/lib/cercles";
import type { CirclePost } from "@/lib/database.types";
import { MONTHS, relativeTime } from "@/lib/format";
import { initial } from "@/components/Avatar";
import { IconCalendrier, IconCoeur } from "@/components/icons";
import {
  addToAgenda,
  deleteCircle,
  deleteComment,
  deletePost,
  leaveCircle,
  react,
} from "./actions";
import {
  CommentForm,
  Composer,
  InviteToCircle,
  LiveCircles,
  NewCircle,
} from "./Forms";

export const metadata: Metadata = { title: "Cercles" };

const TONES = [
  "bg-ivoire text-noir",
  "bg-[#D9A79B] text-noir",
  "bg-noir text-casse",
  "bg-[#7E8FA3] text-casse",
  "bg-[#C8B79A] text-noir",
  "bg-sauge text-casse",
];

export default function CerclesPage(props: PageProps<"/cercles">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Cercles {...props} />
    </Suspense>
  );
}

/** « 12 et 13 décembre », « 12 décembre », « 30 décembre → 2 janvier ». */
function eventDays(day: string, end: string | null, time: string | null) {
  const a = parseIsoDate(day);
  const m = (d: Date) => MONTHS[d.getMonth()].toLowerCase();
  let s = `${a.getDate()} ${m(a)}`;
  if (end && end !== day) {
    const b = parseIsoDate(end);
    const consecutive = b.getTime() - a.getTime() <= 86400e3 * 1.1;
    s =
      a.getMonth() === b.getMonth()
        ? `${a.getDate()} ${consecutive ? "et" : "au"} ${b.getDate()} ${m(b)}`
        : `${a.getDate()} ${m(a)} → ${b.getDate()} ${m(b)}`;
  }
  return time ? `${s} · ${time.slice(0, 5).replace(":", " h ")}` : s;
}

async function Cercles({ searchParams }: PageProps<"/cercles">) {
  const sp = await searchParams;
  const circleId =
    typeof sp.cercle === "string" && /^[0-9a-f-]{36}$/i.test(sp.cercle)
      ? sp.cercle
      : null;
  const data = await getCercles(circleId);
  const current = circleId
    ? data.circles.find((c) => c.id === circleId)
    : undefined;
  const circleName = (id: string) =>
    data.circles.find((c) => c.id === id)?.name ?? "";
  const toneOf = (circle: string, user: string) =>
    TONES[
      Math.max(
        0,
        (data.members[circle] ?? []).findIndex((m) => m.id === user),
      ) % TONES.length
    ];

  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 grid grid-cols-1 xl:grid-cols-[minmax(0,660px)_320px] gap-10 items-start">
      <LiveCircles circleId={current?.id ?? null} />
      <div className="min-w-0 flex flex-col gap-6">
        <header className="flex flex-col gap-1.5">
          <p className="surtitre">
            {current ? (
              <Link href="/cercles" className="hover:text-noir">
                ← Tous les cercles
              </Link>
            ) : (
              `${data.circles.length} cercle${data.circles.length > 1 ? "s" : ""} · tout est privé`
            )}
          </p>
          <h1 className="titre text-[44px] leading-[1.05]">
            {current ? current.name : "Cercles"}
          </h1>
          {current && (
            <p className="text-sm text-doux">
              {current.members} membre{current.members > 1 ? "s" : ""} ·{" "}
              {(data.members[current.id] ?? [])
                .map((m) => (m.id === data.userId ? "toi" : data.names[m.id]))
                .join(", ")}
            </p>
          )}
        </header>

        {data.circles.length === 0 ? (
          <div className="rounded-2xl bg-papier border border-noir/8 p-8 flex flex-col gap-3">
            <h2 className="titre text-3xl">Ton premier cercle</h2>
            <p className="text-doux leading-relaxed">
              Un cercle, c'est un petit groupe privé : ta coloc, ta famille, tes
              amis de prépa. Crée-le, puis invite-les avec un code. Ce que vous
              partagez ne sort jamais du cercle.
            </p>
            <p className="text-sm text-doux">
              Quelqu'un t'a donné un code ?{" "}
              <Link
                href="/rejoindre"
                className="underline underline-offset-4 text-noir"
              >
                Rejoindre avec un code
              </Link>
            </p>
          </div>
        ) : (
          <Composer
            circles={data.circles.map((c) => ({ id: c.id, name: c.name }))}
            defaultCircle={current?.id}
          />
        )}

        {data.posts.map((p) => (
          <Post
            key={p.id}
            post={p}
            data={data}
            circleName={circleName(p.circle_id)}
            showCircle={!current}
            tone={(u) => toneOf(p.circle_id, u)}
          />
        ))}
        {data.circles.length > 0 && data.posts.length === 0 && (
          <p className="text-doux">
            Rien de partagé pour l'instant. Lance la conversation.
          </p>
        )}
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-10">
        <section className="flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between mb-3">
            <h2 className="titre text-[26px]">Tes cercles</h2>
            <NewCircle />
          </div>
          {data.circles.map((c) => (
            <Link
              key={c.id}
              href={`/cercles?cercle=${c.id}`}
              aria-current={current?.id === c.id ? "page" : undefined}
              className={`flex items-center gap-3 py-3 border-b border-trait last:border-0 ${current?.id === c.id ? "font-medium" : ""}`}
            >
              <span
                className="w-10 h-10 shrink-0 rounded-[10px] grid place-items-center font-serif text-lg text-casse"
                style={{ background: MOOD_META[c.color].color }}
              >
                {initial(c.name)}
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm truncate">{c.name}</span>
                <span className="text-xs text-doux">
                  {c.members} membre{c.members > 1 ? "s" : ""}
                  {c.unread > 0
                    ? ` · ${c.unread} nouveauté${c.unread > 1 ? "s" : ""}`
                    : ""}
                </span>
              </span>
              {c.unread > 0 && (
                <i
                  className="w-2 h-2 rounded-full bg-noir"
                  aria-label="Nouveautés"
                />
              )}
            </Link>
          ))}
        </section>

        {current && (
          <section className="rounded-2xl bg-papier border border-noir/8 p-5 flex flex-col gap-3">
            <h2 className="surtitre">Membres</h2>
            {(data.members[current.id] ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <span
                  className={`w-8 h-8 rounded-full grid place-items-center text-xs font-semibold ${toneOf(current.id, m.id)}`}
                >
                  {initial(data.names[m.id])}
                </span>
                <span className="flex-1 text-sm">
                  {m.id === data.userId ? "Toi" : data.names[m.id]}
                </span>
                {m.role === "owner" && (
                  <span className="text-xs text-doux">a créé le cercle</span>
                )}
              </div>
            ))}
            <InviteToCircle circleId={current.id} name={current.name} />
            <details className="text-sm text-doux mt-1">
              <summary className="cursor-pointer hover:text-noir w-fit">
                {current.owner_id === data.userId
                  ? "Supprimer le cercle"
                  : "Quitter le cercle"}
              </summary>
              <form
                action={
                  current.owner_id === data.userId ? deleteCircle : leaveCircle
                }
                className="mt-3 flex flex-col gap-2"
              >
                <input type="hidden" name="circleId" value={current.id} />
                <input type="hidden" name="confirm" value="oui" />
                <span className="text-xs leading-normal">
                  {current.owner_id === data.userId
                    ? "Toutes les publications seront supprimées pour tout le monde."
                    : "Tu ne verras plus ce cercle. Tes publications y restent."}
                </span>
                <button
                  type="submit"
                  className="self-start h-9 px-4 rounded-full border border-terre text-terre text-sm"
                >
                  {current.owner_id === data.userId
                    ? "Supprimer pour tout le monde"
                    : "Quitter"}
                </button>
              </form>
            </details>
          </section>
        )}

        <p className="text-[13px] text-doux leading-relaxed">
          Ici, personne ne te trouve par hasard. On entre dans un cercle avec un
          code d'invitation, et chaque publication reste dans son cercle.
        </p>
      </aside>
    </main>
  );
}

function Post({
  post,
  data,
  circleName,
  showCircle,
  tone,
}: {
  post: CirclePost;
  data: CerclesData;
  circleName: string;
  showCircle: boolean;
  tone: (u: string) => string;
}) {
  const name = (u: string) =>
    u === data.userId ? "Toi" : (data.names[u] ?? "Ancien membre");
  const reactions = data.reactions.filter((r) => r.post_id === post.id);
  const hearts = reactions.filter((r) => r.kind === "coeur");
  const going = reactions.filter((r) => r.kind === "jensuis");
  const myHeart = hearts.some((r) => r.user_id === data.userId);
  const imGoing = going.some((r) => r.user_id === data.userId);
  const comments = data.comments.filter((c) => c.post_id === post.id);
  const isOwner =
    data.circles.find((c) => c.id === post.circle_id)?.owner_id === data.userId;
  const mine = post.author_id === data.userId;

  return (
    <article className="rounded-2xl bg-papier border border-noir/8 p-5 lg:p-6 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span
          className={`w-10 h-10 rounded-full grid place-items-center text-sm font-semibold ${tone(post.author_id)}`}
        >
          {initial(data.names[post.author_id])}
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[15px] font-medium">
            {name(post.author_id)}
          </span>
          <span className="text-xs text-doux">
            {showCircle ? `${circleName} · ` : ""}
            {relativeTime(post.created_at)}
          </span>
        </span>
        {(mine || isOwner) && (
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <button
              type="submit"
              className="text-xs text-doux hover:text-terre"
            >
              {mine ? "Supprimer" : "Retirer"}
            </button>
          </form>
        )}
      </header>

      {post.body && (
        <p className="text-[16px] leading-[1.6] whitespace-pre-wrap break-words">
          {post.body}
        </p>
      )}

      {post.event_title && post.event_day && (
        <div className="rounded-xl border border-noir/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <IconCalendrier size={18} className="text-encre shrink-0" />
          <span className="flex-1 min-w-[180px] flex flex-col">
            <span className="text-[15px] font-medium">{post.event_title}</span>
            <span className="text-xs text-doux">
              Événement ·{" "}
              {eventDays(post.event_day, post.event_end_day, post.event_time)}
              {post.event_place ? ` · ${post.event_place}` : ""}
            </span>
          </span>
          {data.inAgenda.includes(post.id) ? (
            <span className="text-[13px] text-doux">Dans ton agenda</span>
          ) : (
            <form action={addToAgenda}>
              <input type="hidden" name="postId" value={post.id} />
              <button
                type="submit"
                className="h-9 px-3.5 rounded-full border border-noir/15 text-[13px] hover:bg-lin"
              >
                Ajouter à mon agenda
              </button>
            </form>
          )}
        </div>
      )}

      {post.quote_text && (
        <figure className="rounded-xl bg-[#E8E1D6] px-5 py-4 flex flex-col gap-2">
          <figcaption className="surtitre">Citation</figcaption>
          <blockquote className="font-serif italic text-[22px] leading-snug">
            « {post.quote_text} »
          </blockquote>
          {post.quote_source && <p className="text-sm">{post.quote_source}</p>}
        </figure>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ReactBtn
          postId={post.id}
          circleId={post.circle_id}
          kind="coeur"
          on={myHeart}
        >
          <IconCoeur size={15} filled={myHeart} />
          {hearts.length > 0 ? hearts.length : ""}
          <span className="sr-only">J'aime</span>
        </ReactBtn>
        {post.event_title && (
          <ReactBtn
            postId={post.id}
            circleId={post.circle_id}
            kind="jensuis"
            on={imGoing}
          >
            J'en suis{going.length ? ` · ${going.length}` : ""}
          </ReactBtn>
        )}
        <span className="flex-1" />
        {comments.length > 0 && (
          <span className="text-[13px] text-doux">
            {comments.length} commentaire{comments.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="border-t border-trait pt-4 flex flex-col gap-3">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5 text-[14px]">
            <span
              className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold ${tone(c.author_id)}`}
            >
              {initial(data.names[c.author_id])}
            </span>
            <p className="flex-1 min-w-0 pt-1 leading-snug break-words">
              <span className="font-medium">{name(c.author_id)}</span> {c.body}
            </p>
            {(c.author_id === data.userId || isOwner) && (
              <form action={deleteComment}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-xs text-doux hover:text-terre pt-1.5"
                  aria-label="Supprimer le commentaire"
                >
                  ×
                </button>
              </form>
            )}
          </div>
        ))}
        <CommentForm postId={post.id} circleId={post.circle_id} />
      </div>
    </article>
  );
}

function ReactBtn({
  postId,
  circleId,
  kind,
  on,
  children,
}: {
  postId: string;
  circleId: string;
  kind: "coeur" | "jensuis";
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={react}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="on" value={on ? "1" : "0"} />
      <button
        type="submit"
        aria-pressed={on}
        className={`h-9 px-3.5 rounded-full border text-[13px] flex items-center gap-1.5 ${on ? "bg-noir border-noir text-casse" : "border-noir/12 hover:border-noir/30"}`}
      >
        {children}
      </button>
    </form>
  );
}
