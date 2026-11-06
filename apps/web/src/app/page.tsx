import Link from "next/link";
import { btn } from "@/components/ui";
import { LegalFooter } from "@/components/LegalPage";

export default function Accueil() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <span className="titre italic text-3xl champagne">anima</span>
        <Link href="/connexion" className="text-sm font-medium underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </header>
      <section className="flex-1 px-6 md:px-12 py-16 md:py-24 max-w-4xl flex flex-col gap-8">
        <p className="surtitre">Journal intime · journaux partagés</p>
        <h1 className="titre text-5xl md:text-7xl leading-[1.02]">
          Écrire sa vie,
          <br />
          <em className="italic champagne pr-3">seul ou à plusieurs.</em>
        </h1>
        <p className="text-lg text-doux max-w-xl leading-relaxed">
          Un journal intime qui reste à toi, et des journaux à deux, entre amis ou en famille, où chacun écrit sa
          page du jour. Privé par défaut, hébergé en Europe.
        </p>
        <div>
          <Link href="/connexion" className={btn}>
            Commencer
          </Link>
        </div>
      </section>
      <LegalFooter />
    </main>
  );
}
