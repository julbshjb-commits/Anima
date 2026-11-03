import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { supabaseEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";

export const metadata: Metadata = { title: "Connexion" };

export default function Connexion({ searchParams }: PageProps<"/connexion">) {
  if (!supabaseEnv()) return <NotConfigured />;
  return (
    <main className="flex-1 grid md:grid-cols-2">
      <section className="px-6 md:px-16 py-10 flex flex-col">
        <Link href="/" className="titre text-2xl">
          Anima
        </Link>
        <div className="flex-1 flex flex-col justify-center gap-8 max-w-sm py-16">
          <div className="flex flex-col gap-2">
            <p className="surtitre">Connexion</p>
            <h1 className="titre text-4xl">Content de te revoir.</h1>
          </div>
          <Suspense>
            <Form searchParams={searchParams} />
          </Suspense>
          <p className="text-xs text-doux leading-relaxed">
            En continuant, tu acceptes les{" "}
            <Link href="/conditions" className="underline underline-offset-4">
              conditions d'utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </section>
      <aside
        aria-hidden
        className="hidden md:block bg-[linear-gradient(150deg,#292826,#151515)] relative overflow-hidden"
      >
        <p className="titre italic absolute left-12 right-12 bottom-16 text-4xl leading-tight text-ivoire">
          « Ce qu'on écrit le soir finit par dessiner une vie. »
        </p>
      </aside>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/connexion">["searchParams"] }) {
  const sp = await searchParams;
  const suite = typeof sp.suite === "string" ? sp.suite : undefined;
  const erreur = sp.erreur === "lien";
  return (
    <>
      {erreur && (
        <p role="alert" className="text-sm text-terre">
          Ce lien n'est plus valable. Demande-en un nouveau.
        </p>
      )}
      <LoginForm suite={suite} />
    </>
  );
}
