import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getAiSpaces } from "@/lib/ia";
import { AiSpacesPicker } from "@/components/AiSpacesPicker";
import { card } from "@/components/ui";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = { title: "Autoriser une appli" };

/**
 * Page d'autorisation du serveur OAuth de Supabase : une appli tierce
 * (Claude…) demande à accéder à Anima. La personne choisit les espaces.
 */
export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main className="flex-1 flex justify-center px-5 py-10">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <Link href="/flashcards" className="titre text-2xl">
          Anima
        </Link>
        <Suspense fallback={<p className="text-doux">Chargement…</p>}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Consent({ searchParams }: Pick<PageProps<"/oauth/consent">, "searchParams">) {
  const sp = await searchParams;
  const id = typeof sp.authorization_id === "string" ? sp.authorization_id : "";
  const { supabase, user } = await requireUser();
  if (!id) return <Problem text="Il manque la demande d'autorisation. Recommence depuis l'appli qui veut se connecter." />;

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <Problem text="Cette demande a expiré ou n'existe pas. Recommence depuis l'appli." />;
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const selected = await getAiSpaces(supabase, user.id);
  let host = "";
  try {
    host = new URL(data.redirect_uri).host;
  } catch {}

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="surtitre">Autorisation</p>
        <h1 className="titre text-4xl leading-tight text-balance">{data.client.name || "Une appli"} veut accéder à ton Anima</h1>
        <p className="text-sm text-doux leading-relaxed">
          Connecté avec {user.email}. L'appli pourra lire et ajouter des éléments, uniquement dans les espaces que tu coches. Tu
          pourras changer d'avis à tout moment dans Réglages.
          {host && (
            <>
              {" "}
              Après ton accord, tu reviens sur <b>{host}</b>.
            </>
          )}
        </p>
      </div>
      <section className={`${card} p-6`}>
        <ConsentForm authorizationId={data.authorization_id}>
          <AiSpacesPicker selected={selected} />
        </ConsentForm>
      </section>
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="titre text-3xl">Autorisation impossible</h1>
      <p className="text-sm text-doux">{text}</p>
    </div>
  );
}
