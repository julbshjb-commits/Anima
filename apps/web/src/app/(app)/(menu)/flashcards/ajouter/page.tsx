import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { cardFace, coverOf, formatDeckCode, isValidDeckCode, normalizeInviteCode, variantsFor } from "@anima/core";
import { requireUser } from "@/lib/auth";
import { IconRetour } from "@/components/icons";
import { btn, card as surface } from "@/components/ui";
import { importDeck } from "../actions";

export const metadata: Metadata = { title: "Ajouter un paquet partagé" };

/** Aperçu d'un paquet partagé par un camarade, puis ajout de sa propre copie. */
export default function AddSharedDeck(props: PageProps<"/flashcards/ajouter">) {
  return (
    <main className="px-5 py-8 lg:px-12 lg:pt-10 lg:pb-14 flex flex-col gap-7 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/flashcards" aria-label="Retour aux flashcards" className="w-9 h-9 rounded-full border border-trait grid place-items-center hover:bg-lin">
          <IconRetour size={16} />
        </Link>
        <p className="surtitre">Paquet partagé</p>
      </div>
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Preview {...props} />
      </Suspense>
    </main>
  );
}

function CodeForm({ code, error }: { code?: string; error?: string }) {
  return (
    <form action="/flashcards/ajouter" className="flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Code du paquet</span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          defaultValue={code}
          placeholder="K7MQ-2PXA"
          className="h-16 px-5 rounded-xl bg-papier border border-trait titre text-4xl tracking-[0.12em] uppercase focus:outline-none focus:border-texte/40 placeholder:text-doux/50"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-terre">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className={btn}>
          Voir le paquet
        </button>
      </div>
    </form>
  );
}

async function Preview({ searchParams }: PageProps<"/flashcards/ajouter">) {
  await connection();
  const { code: raw, erreur } = await searchParams;
  const typed = typeof raw === "string" ? raw : "";
  const intro = (
    <div className="flex flex-col gap-2">
      <h1 className="titre text-[44px] leading-[1.05]">Ajouter le paquet d'un camarade</h1>
      <p className="text-doux max-w-xl">
        Tape le code qu'on t'a donné. Tu reçois ta propre copie : tes réponses et tes progrès restent à toi, et tu pourras récupérer les cartes que l'auteur ajoutera ensuite.
      </p>
    </div>
  );
  if (!typed) return (
    <>
      {intro}
      <CodeForm error={erreur ? "Un code de paquet fait 8 caractères, par exemple K7MQ-2PXA." : undefined} />
    </>
  );
  if (!isValidDeckCode(typed))
    return (
      <>
        {intro}
        <CodeForm code={typed} error="Un code de paquet fait 8 caractères, par exemple K7MQ-2PXA." />
      </>
    );

  const code = normalizeInviteCode(typed);
  const { supabase } = await requireUser();
  const { data: p } = await supabase.rpc("deck_preview", { p_code: code });
  if (!p)
    return (
      <>
        {intro}
        <CodeForm code={formatDeckCode(code)} error="Ce code ne correspond à aucun paquet partagé. Il a peut-être été retiré par son auteur." />
      </>
    );

  const c = coverOf(p.cover);
  return (
    <>
      <section className="entree relative isolate overflow-hidden rounded-2xl bg-[#111112] border border-champagne/25 shadow-[0_40px_90px_-50px_rgba(230,200,145,.45)] text-blanc p-7 lg:p-9 flex flex-col gap-6">
        <div className="halo" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="relative flex items-end gap-5">
          <span aria-hidden className="w-16 h-[86px] shrink-0 rounded-lg shadow-[0_16px_34px_-14px_rgba(0,0,0,.9)]" style={{ background: c.bg }} />
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="surtitre !text-blanc/70">{p.subject ?? "Flashcards"}</p>
            <h1 className="titre text-[38px] lg:text-[46px] leading-[1.02]">{p.title}</h1>
            <p className="text-sm text-blanc/70">
              Partagé par {p.author} · {p.cards} carte{p.cards > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {p.description && <p className="relative text-[15px] text-blanc/75 max-w-xl">{p.description}</p>}
        <div className="relative">
          {p.mine ? (
            <p className="text-sm text-blanc/75">C'est ton paquet. Donne ce code à ta promo pour qu'elle l'ajoute.</p>
          ) : (
            <form action={importDeck}>
              <input type="hidden" name="code" value={code} />
              <button type="submit" className="bouton-or inline-flex items-center h-12 px-7 rounded-full text-nuit text-sm font-semibold shadow-[0_14px_40px_-12px_rgba(224,184,120,.7)]">
                {p.copied ? "Ouvrir ma copie et récupérer les nouveautés" : "Ajouter à mes paquets"}
              </button>
            </form>
          )}
        </div>
      </section>

      {p.sample.length > 0 && (
        <section style={{ ["--i" as string]: 1 }} className="entree flex flex-col gap-3">
          <h2 className="surtitre">Un aperçu</h2>
          <ul className="grid sm:grid-cols-3 gap-3">
            {p.sample.map((s, i) => {
              const v = variantsFor(s.kind, s.front)[0] ?? 0;
              return (
                <li key={i} className={`${surface} p-4 flex flex-col gap-2`}>
                  <p className="text-[15px] leading-snug line-clamp-4">{cardFace(s, v, "question")}</p>
                  <p className="text-[13px] text-champagne leading-snug line-clamp-3">{cardFace(s, v, "reponse")}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
