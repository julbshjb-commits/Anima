import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

/** Mise en page commune des pages légales : lisible, sobre, accessible sans compte. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <Link href="/" className="titre text-2xl">
          Anima
        </Link>
      </header>
      <article className="legal mx-auto w-full max-w-2xl px-6 pb-20 flex flex-col gap-5 leading-relaxed">
        <h1 className="titre text-5xl">{title}</h1>
        <p className="text-sm text-doux">Dernière mise à jour : {LEGAL.miseAJour}</p>
        {children}
      </article>
      <LegalFooter />
    </main>
  );
}

export function LegalFooter() {
  return (
    <footer className="px-6 md:px-12 py-8 text-xs text-doux flex flex-wrap gap-x-6 gap-y-2">
      <span>Anima · données hébergées dans l'Union européenne</span>
      <Link href="/confidentialite" className="hover:underline underline-offset-4">
        Confidentialité
      </Link>
      <Link href="/conditions" className="hover:underline underline-offset-4">
        Conditions d'utilisation
      </Link>
      <Link href="/regles" className="hover:underline underline-offset-4">
        Règles de la communauté
      </Link>
      <Link href="/mentions-legales" className="hover:underline underline-offset-4">
        Mentions légales
      </Link>
    </footer>
  );
}
