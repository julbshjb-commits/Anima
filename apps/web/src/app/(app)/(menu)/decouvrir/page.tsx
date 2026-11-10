import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Mood } from "@anima/core";
import { getFeed, getMe, pendingRequests, searchProfiles, suggestions } from "@/lib/reseau";
import { PostCard } from "@/components/social/PostCard";
import { ProfilePic } from "@/components/social/ProfilePic";
import { Composer } from "@/components/social/Client";
import { IconLoupe } from "@/components/icons";
import { btn } from "@/components/ui";
import { acceptFollower, follow, removeFollower } from "./actions";

export const metadata: Metadata = { title: "Découvrir" };

export default function DecouvrirPage(props: PageProps<"/decouvrir">) {
  return (
    <Suspense fallback={<p className="p-10 text-doux">Chargement…</p>}>
      <Decouvrir {...props} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Decouvrir({ searchParams }: PageProps<"/decouvrir">) {
  const sp = await searchParams;
  const { supabase, user, me } = await getMe();
  if (!me) return <Welcome />;

  const tab = one(sp.onglet) === "abonnements" ? "abonnements" : "pour-toi";
  const q = one(sp.q)?.slice(0, 60) ?? "";
  const entreeId = one(sp.entree);

  // « Publier » depuis une page de journal : on reprend le texte, jamais d'un journal intime.
  let initial: { body: string; mood: Mood | null; source: "journal"; label: string } | undefined;
  if (entreeId && /^[0-9a-f-]{36}$/i.test(entreeId)) {
    const { data: e } = await supabase
      .from("journal_entries")
      .select("content_text, mood, author_id, journal_id, journals(kind, title)")
      .eq("id", entreeId)
      .is("deleted_at", null)
      .maybeSingle();
    const j = e?.journals as unknown as { kind: string; title: string } | null;
    if (e && e.author_id === user.id && j && j.kind !== "intime")
      initial = { body: e.content_text.slice(0, 2000), mood: e.mood, source: "journal", label: `ta page dans « ${j.title} »` };
  }

  const [posts, people, sugg, pending] = await Promise.all([
    q ? Promise.resolve([]) : getFeed(supabase, user.id, tab),
    q ? searchProfiles(supabase, q) : Promise.resolve([]),
    suggestions(supabase, user.id),
    pendingRequests(supabase, user.id),
  ]);
  const welcome = one(sp.bienvenue) === "1";

  return (
    <main className="px-4 sm:px-6 py-6 lg:px-10 lg:pt-10 flex gap-10 justify-center">
      <div className="w-full max-w-[640px] flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="surtitre">Le réseau Anima</p>
            <h1 className="titre text-[40px] sm:text-[48px] leading-[1.02]">Découvrir</h1>
          </div>
          <Link href={`/u/${me.handle}`} className="xl:hidden">
            <ProfilePic name={me.name} handle={me.handle} src={me.avatar} size={44} ring />
          </Link>
        </div>

        {welcome && (
          <p className="rounded-2xl px-4 py-3 bg-champagne/12 border border-champagne/30 text-sm">
            Bienvenue <b>@{me.handle}</b> ! Ajoute une photo depuis{" "}
            <Link href="/decouvrir/profil" className="underline underline-offset-4">
              ton profil
            </Link>{" "}
            et publie ton premier mot.
          </p>
        )}

        <form className="relative" role="search">
          <IconLoupe className="absolute z-10 pointer-events-none left-4 top-1/2 -translate-y-1/2 text-doux" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Chercher une personne ou un @pseudo"
            className="w-full h-12 pl-11 pr-4 rounded-full bg-papier border border-trait text-base placeholder:text-doux focus:outline-none focus:border-texte/40"
          />
        </form>

        {q ? (
          <section className="flex flex-col gap-2">
            <p className="text-sm text-doux">
              {people.length ? `${people.length} profil${people.length > 1 ? "s" : ""}` : "Personne ne correspond."}{" "}
              <Link href="/decouvrir" className="underline underline-offset-4">
                Revenir au fil
              </Link>
            </p>
            {people.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </section>
        ) : (
          <>
            <Composer userId={user.id} me={me} initial={initial} />

            <nav className="flex gap-1 p-1 rounded-full bg-papier border border-trait self-start" aria-label="Fils">
              {(
                [
                  ["pour-toi", "Pour toi"],
                  ["abonnements", "Abonnements"],
                ] as const
              ).map(([id, label]) => (
                <Link
                  key={id}
                  href={`/decouvrir?onglet=${id}`}
                  aria-current={tab === id ? "page" : undefined}
                  className={`h-9 px-4 grid place-items-center rounded-full text-sm transition-colors ${tab === id ? "bg-[linear-gradient(180deg,#f0d8a8,#d4ad6c)] text-nuit font-semibold" : "text-doux hover:text-noir"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {posts.length ? (
              <div className="flex flex-col gap-4">
                {posts.map((p, i) => (
                  <PostCard key={p.id} post={p} me={user.id} index={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-trait p-10 text-center flex flex-col gap-2 items-center">
                <p className="titre text-2xl">{tab === "abonnements" ? "Ton fil est encore calme." : "Rien pour l'instant."}</p>
                <p className="text-sm text-doux max-w-sm">
                  {tab === "abonnements" ? "Abonne-toi à des personnes pour voir leurs publications ici." : "Sois la première personne à publier quelque chose."}
                </p>
              </div>
            )}
          </>
        )}

        {/* Sur téléphone et iPad, les suggestions passent sous le fil. */}
        <div className="xl:hidden flex flex-col gap-5">
          <Aside me={me} sugg={sugg} pending={pending} />
        </div>
      </div>

      <aside className="hidden xl:flex w-[320px] shrink-0 flex-col gap-5 sticky top-10 self-start">
        <Link href={`/u/${me.handle}`} className="rounded-[28px] bg-papier border border-trait p-5 flex items-center gap-3.5 hover:bg-lin transition-colors">
          <ProfilePic name={me.name} handle={me.handle} src={me.avatar} size={52} ring />
          <span className="min-w-0 flex-1">
            <span className="block font-medium truncate">{me.name}</span>
            <span className="block text-sm text-doux truncate">@{me.handle}</span>
          </span>
          <span className="text-right text-xs text-doux leading-tight">
            <b className="block text-base text-noir tabular-nums">{me.followers_count}</b>abonnés
          </span>
        </Link>
        <Aside me={me} sugg={sugg} pending={pending} />
      </aside>
    </main>
  );
}

type Person = { id: string; handle: string; name: string; avatar: string | null; bio?: string; followers_count?: number; is_private: boolean };

function PersonRow({ p, action = true }: { p: Person; action?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-lin transition-colors">
      <Link href={`/u/${p.handle}`} className="flex items-center gap-3 min-w-0 flex-1">
        <ProfilePic name={p.name} handle={p.handle} src={p.avatar} size={44} />
        <span className="min-w-0">
          <span className="block font-medium truncate">{p.name}</span>
          <span className="block text-[13px] text-doux truncate">
            @{p.handle}
            {p.bio ? ` · ${p.bio}` : ""}
          </span>
        </span>
      </Link>
      {action && (
        <form action={follow}>
          <input type="hidden" name="id" value={p.id} />
          <button className="h-9 px-4 rounded-full bg-noir text-casse text-sm font-semibold hover:opacity-90">Suivre</button>
        </form>
      )}
    </div>
  );
}

function Aside({ sugg, pending }: { me: { handle: string }; sugg: Person[]; pending: Person[] }) {
  return (
    <>
      {pending.length > 0 && (
        <section className="rounded-[28px] bg-papier border border-trait p-4 flex flex-col gap-1">
          <h2 className="surtitre px-2 pb-1">Demandes d&apos;abonnement</h2>
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-2">
              <Link href={`/u/${p.handle}`} className="flex items-center gap-3 min-w-0 flex-1">
                <ProfilePic name={p.name} handle={p.handle} src={p.avatar} size={38} />
                <span className="min-w-0 text-sm">
                  <span className="block font-medium truncate">{p.name}</span>
                  <span className="block text-doux truncate">@{p.handle}</span>
                </span>
              </Link>
              <form action={acceptFollower}>
                <input type="hidden" name="id" value={p.id} />
                <button className="h-8 px-3 rounded-full bg-noir text-casse text-xs font-semibold">Accepter</button>
              </form>
              <form action={removeFollower}>
                <input type="hidden" name="id" value={p.id} />
                <button className="h-8 px-3 rounded-full border border-trait text-xs">Refuser</button>
              </form>
            </div>
          ))}
        </section>
      )}
      {sugg.length > 0 && (
        <section className="rounded-[28px] bg-papier border border-trait p-3 flex flex-col">
          <h2 className="surtitre px-3 pt-2 pb-1">À découvrir</h2>
          {sugg.map((p) => (
            <PersonRow key={p.id} p={p} />
          ))}
        </section>
      )}
      <p className="px-3 text-xs text-doux leading-relaxed">
        Ton journal intime n&apos;est jamais publié. Seul ce que tu choisis de partager arrive ici.{" "}
        <Link href="/regles" className="underline underline-offset-4">
          Règles de la communauté
        </Link>
      </p>
    </>
  );
}

/** Pas encore de profil public : on présente le réseau et on invite à en créer un. */
function Welcome() {
  return (
    <main className="px-4 sm:px-6 py-6 lg:px-12 lg:pt-10 flex flex-col gap-8 max-w-5xl">
      <section className="relative isolate overflow-hidden rounded-[32px] bg-[#111112] text-blanc p-8 sm:p-12 lg:p-16 flex flex-col gap-7 min-h-[440px] justify-end">
        <div className="halo" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="voile" aria-hidden />
        <p className="relative surtitre !text-blanc/80">Nouveau · le réseau Anima</p>
        <h1 className="relative titre text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.02] max-w-3xl">
          Partage ce qui t&apos;<span className="italic champagne">anime</span>, avec le monde entier.
        </h1>
        <p className="relative text-blanc/80 max-w-xl text-[17px] leading-relaxed">
          Un fil calme et beau : des pensées, des citations, des photos, des pages que tu choisis de rendre publiques. Pas de pub, pas de course aux
          chiffres, hébergé en Europe.
        </p>
        <div className="relative flex flex-wrap gap-3">
          <Link href="/decouvrir/profil" className={`${btn} h-12 px-7 text-[15px]`}>
            Créer mon profil public
          </Link>
        </div>
      </section>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ["Ton intime reste intime", "Tes journaux et tes notes ne sont jamais publiés. Rien ne part sans un geste de ta part."],
          ["Public ou privé", "Compte ouvert à tous, ou compte privé où tu acceptes chaque abonné."],
          ["Bienveillant par défaut", "Signalement en un geste, blocage, modération par l'équipe Anima. Dès 15 ans."],
        ].map(([t, d], i) => (
          <div key={t} className="rounded-[24px] bg-papier border border-trait p-6 flex flex-col gap-2 animate-monte" style={{ animationDelay: `${i * 90}ms` }}>
            <h2 className="titre text-[22px]">{t}</h2>
            <p className="text-sm text-doux leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

