import Link from "next/link";
import { MOOD_META, compactCount } from "@anima/core";
import type { FeedPost } from "@/lib/reseau";
import { relativeTime } from "@/lib/format";
import { IconBulle, IconCadenas } from "@/components/icons";
import { ContentMenu, LikeButton } from "./Client";
import { ProfilePic } from "./ProfilePic";

const SOURCE: Record<string, string> = { journal: "Page de journal", note: "Extrait de notes" };

/** Une publication du réseau : verre fumé, auteur, texte ou citation, photo polaroïd, j'aime. */
export function PostCard({ post, me, index = 0, detail = false }: { post: FeedPost; me: string; index?: number; detail?: boolean }) {
  const mood = post.mood ? MOOD_META[post.mood] : null;
  const long = !detail && post.body.length > 420;
  return (
    <article
      className="relative rounded-[28px] bg-papier border border-trait p-4 sm:p-5 flex flex-col gap-3.5 animate-monte"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {post.hidden_at && (
        <p className="text-xs px-3 py-2 rounded-xl bg-terre/15 text-terre">
          Masquée après des signalements : seuls toi et l&apos;équipe Anima la voyez.
        </p>
      )}
      <header className="flex items-center gap-3">
        <Link href={`/u/${post.author.handle}`} className="shrink-0">
          <ProfilePic name={post.author.name} handle={post.author.handle} src={post.author.avatar} size={42} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/u/${post.author.handle}`} className="font-medium hover:underline underline-offset-4 inline-flex items-center gap-1.5">
            {post.author.name}
            {post.author.is_private && <IconCadenas size={13} className="text-doux" />}
          </Link>
          <p className="text-[13px] text-doux truncate">
            @{post.author.handle} · {relativeTime(post.created_at)}
            {post.edited_at && " · modifiée"}
          </p>
        </div>
        {mood && (
          <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs" style={{ background: `${mood.color}26`, color: mood.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: mood.color }} />
            {mood.label}
          </span>
        )}
        <ContentMenu kind="post" targetId={post.id} authorId={post.author_id} authorHandle={post.author.handle} mine={post.author_id === me} back={detail} />
      </header>

      {SOURCE[post.source] && <p className="surtitre text-[11px] text-champagne/80">{SOURCE[post.source]}</p>}

      {post.body &&
        (post.source === "citation" ? (
          <blockquote className="flex flex-col gap-2 pl-4 border-l-2 border-champagne/60">
            <p className="titre italic text-[24px] sm:text-[26px] leading-[1.3] text-noir">« {post.body} »</p>
            {post.quote_by && <footer className="text-sm text-doux">— {post.quote_by}</footer>}
          </blockquote>
        ) : (
          <div className={`text-[16.5px] leading-[1.6] whitespace-pre-wrap break-words ${long ? "line-clamp-[9]" : ""}`}>{post.body}</div>
        ))}
      {long && (
        <Link href={`/p/${post.id}`} className="text-sm text-champagne self-start">
          Lire la suite
        </Link>
      )}

      {post.photo && (
        <Link href={`/p/${post.id}`} className={`block self-start bg-[#f7f2ea] p-2 pb-7 rounded-md shadow-[0_20px_40px_-18px_rgba(0,0,0,.9)] transition-transform duration-500 hover:rotate-0 ${index % 2 ? "rotate-[0.8deg]" : "-rotate-[0.8deg]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photo} alt="" className="max-h-[460px] w-auto max-w-full rounded-sm object-cover" loading="lazy" />
        </Link>
      )}

      <footer className="flex items-center gap-1 -ml-2">
        <LikeButton postId={post.id} liked={post.liked} count={post.likes_count} />
        <Link href={`/p/${post.id}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm text-doux hover:text-noir hover:bg-lin" aria-label="Commentaires">
          <IconBulle size={18} />
          {post.comments_count > 0 && <span className="tabular-nums">{compactCount(post.comments_count)}</span>}
        </Link>
      </footer>
    </article>
  );
}
