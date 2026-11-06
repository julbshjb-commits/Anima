import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMe, getPost } from "@/lib/reseau";
import { relativeTime } from "@/lib/format";
import { PostCard } from "@/components/social/PostCard";
import { ProfilePic } from "@/components/social/ProfilePic";
import { CommentForm, ContentMenu } from "@/components/social/Client";
import { IconRetour } from "@/components/icons";
import { deleteComment } from "../../decouvrir/actions";

export const metadata: Metadata = { title: "Publication" };

export default function PostPage(props: PageProps<"/p/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Post {...props} />
    </Suspense>
  );
}

async function Post({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ post, comments, user }, { me }] = await Promise.all([getPost(id), getMe()]);
  if (!post) notFound();
  const mineOrAuthor = (authorId: string) => authorId === user.id || post.author_id === user.id;

  return (
    <main className="px-4 sm:px-6 py-6 lg:px-10 lg:pt-10 flex justify-center">
      <div className="w-full max-w-[640px] flex flex-col gap-5">
        <Link href="/decouvrir" className="inline-flex items-center gap-1.5 text-sm text-doux hover:text-noir self-start">
          <IconRetour size={16} /> Découvrir
        </Link>
        <PostCard post={post} me={user.id} detail />
        <section className="flex flex-col gap-4 px-1">
          <h2 className="surtitre">{comments.length ? `${comments.length} commentaire${comments.length > 1 ? "s" : ""}` : "Commentaires"}</h2>
          {me ? (
            <CommentForm postId={post.id} me={me} />
          ) : (
            <p className="text-sm text-doux">
              <Link href="/decouvrir/profil" className="underline underline-offset-4">
                Crée ton profil public
              </Link>{" "}
              pour commenter.
            </p>
          )}
          <ul className="flex flex-col gap-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3 animate-monte">
                <Link href={`/u/${c.author.handle}`}>
                  <ProfilePic name={c.author.name} handle={c.author.handle} src={c.author.avatar} size={36} />
                </Link>
                <div className="flex-1 min-w-0 rounded-2xl bg-papier border border-trait px-4 py-3">
                  <p className="text-[13px] text-doux">
                    <Link href={`/u/${c.author.handle}`} className="font-medium text-noir hover:underline underline-offset-4">
                      {c.author.name}
                    </Link>{" "}
                    · {relativeTime(c.created_at)}
                  </p>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
                  {c.hidden_at && <p className="text-xs text-terre mt-1">Masqué après des signalements.</p>}
                </div>
                <div className="flex flex-col items-center">
                  {mineOrAuthor(c.author_id) ? (
                    <form action={deleteComment}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs text-doux hover:text-terre h-9 px-2">Retirer</button>
                    </form>
                  ) : (
                    <ContentMenu kind="comment" targetId={c.id} authorId={c.author_id} authorHandle={c.author.handle} mine={false} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
