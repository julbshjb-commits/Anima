import Link from "next/link";
import { btn } from "@/components/ui";
import { LegalFooter } from "@/components/LegalPage";

const ATOUTS = [
  {
    titre: "Tes cours deviennent des cartes",
    texte: "Colle une note, un cours ou un PDF : Anima en tire des questions courtes et justes, que tu relis avant de les garder.",
  },
  {
    titre: "Tu révises au bon moment",
    texte: "Chaque réponse règle la prochaine révision. On revoit souvent ce qui résiste, rarement ce qui est su. Dix minutes par jour suffisent.",
  },
  {
    titre: "Seul ou avec ta promo",
    texte: "Prends les notes de cours à plusieurs, partagez vos paquets, et suivez vos séries de révision jusqu'aux partiels.",
  },
];

const AUSSI = ["Journal", "Notes", "Organisation", "Cercles", "Bibliothèque", "Fichiers"];

export default function Accueil() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <span className="titre italic text-3xl champagne">anima</span>
        <Link href="/connexion" className="text-sm font-medium underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </header>
      <section className="px-6 md:px-12 pt-16 md:pt-24 pb-12 max-w-4xl flex flex-col gap-8">
        <p className="surtitre">Anima Flashcards</p>
        <h1 className="titre text-5xl md:text-7xl leading-[1.02]">
          Retiens tout
          <br />
          <em className="italic champagne pr-3">ce que tu apprends.</em>
        </h1>
        <p className="text-lg text-doux max-w-xl leading-relaxed">
          Tes cours deviennent des flashcards, et tu révises au bon moment, seul ou avec ta promo. Privé, hébergé en
          Europe, sans pub.
        </p>
        <div>
          <Link href="/connexion" className={btn}>
            Créer mes premières cartes
          </Link>
        </div>
      </section>
      <section className="px-6 md:px-12 pb-16 md:pb-24 max-w-6xl">
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ATOUTS.map((a) => (
            <li key={a.titre} className="rounded-2xl border border-lin bg-blanc/[0.03] p-6 flex flex-col gap-2">
              <h2 className="titre text-[26px] leading-tight">{a.titre}</h2>
              <p className="text-sm text-doux leading-relaxed">{a.texte}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-doux">
          Aussi dans Anima :{" "}
          {AUSSI.map((b, i) => (
            <span key={b}>
              <span className="text-champagne">{b}</span>
              {i < AUSSI.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      </section>
      <LegalFooter />
    </main>
  );
}
