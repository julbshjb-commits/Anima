import type { Metadata } from "next";
import Link from "next/link";
import { SondageForm } from "./SondageForm";
import { supabaseEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";

export const metadata: Metadata = {
  title: "Comment tu révises ?",
  description: "2 minutes pour nous dire comment tu révises. Anonyme.",
};

export default function Sondage() {
  if (!supabaseEnv()) return <NotConfigured />;
  return (
    <main className="flex-1 px-5 py-10 md:py-16">
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        <Link href="/" className="titre text-2xl">Anima</Link>
        <header className="flex flex-col gap-3">
          <p className="surtitre">2 minutes · anonyme</p>
          <h1 className="titre text-4xl md:text-5xl">Comment tu révises ?</h1>
          <p className="text-doux leading-relaxed">
            On construit une appli de révision pensée pour les étudiants. Avant, on veut comprendre comment tu travailles vraiment. Il n'y a pas de
            bonne ou de mauvaise réponse.
          </p>
        </header>
        <SondageForm />
        <p className="text-xs text-doux">
          Réponses anonymes, stockées en Europe. Voir notre <Link href="/confidentialite" className="underline underline-offset-4">politique de confidentialité</Link>.
        </p>
      </div>
    </main>
  );
}
