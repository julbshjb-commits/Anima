import Link from "next/link";
import { btn, btnGhost } from "@/components/ui";
import { LegalFooter } from "@/components/LegalPage";
import { DemoCarte } from "@/components/landing/DemoCarte";
import { Revele } from "@/components/landing/Revele";
import {
  IconBibliotheque,
  IconBoussole,
  IconCadenas,
  IconCartes,
  IconCercles,
  IconCoche,
  IconDossier,
  IconJournaux,
  IconNotes,
} from "@/components/icons";

const MATIERES = ["Biologie", "Droit", "Médecine", "Histoire", "Anglais", "Maths", "Philosophie", "Économie", "Chimie", "Psychologie", "Code de la route", "Langues"];

const ESPACES = [
  { Icone: IconCartes, nom: "Flashcards", texte: "Tes cours en cartes, révisées au bon moment." },
  { Icone: IconNotes, nom: "Notes", texte: "Tes notes de cours, seul ou à plusieurs." },
  { Icone: IconJournaux, nom: "Journal", texte: "Un journal intime, et des journaux à partager." },
  { Icone: IconCoche, nom: "Organiser", texte: "Tâches, agenda, dates d'examen." },
  { Icone: IconCercles, nom: "Cercles", texte: "Tes groupes privés, entrée par code." },
  { Icone: IconBibliotheque, nom: "Bibliothèque", texte: "Tes lectures et tes citations préférées." },
  { Icone: IconDossier, nom: "Fichiers", texte: "Tes documents, rangés avec le reste." },
  { Icone: IconBoussole, nom: "Découvrir", texte: "Le réseau Anima, si tu veux partager." },
];

const QUESTIONS = [
  {
    q: "C'est gratuit ?",
    r: "Oui, Anima est gratuit pendant son lancement. Si une offre payante apparaît un jour, elle sera optionnelle.",
  },
  {
    q: "Comment marche la révision au bon moment ?",
    r: "Après chaque carte, tu dis si c'était facile ou non. Anima calcule quand te la reposer : bientôt si elle résiste, dans plusieurs jours si tu la connais. C'est la répétition espacée, la méthode qu'utilisent les étudiants en médecine depuis des années.",
  },
  {
    q: "Mes journaux et mes notes sont-ils publics ?",
    r: "Non. Tout est privé par défaut. Rien n'apparaît sur le réseau Anima sans que tu appuies sur « Publier », et ton journal intime ne peut jamais être publié.",
  },
  {
    q: "L'IA lit-elle ce que j'écris ?",
    r: "Seulement quand tu lui demandes de créer des cartes à partir d'un texte que tu lui donnes, et tu relis chaque carte avant de la garder. Elle ne lit jamais tes journaux sans ton accord.",
  },
  {
    q: "Où sont mes données ?",
    r: "Sur des serveurs dans l'Union européenne. Pas de publicité, pas de revente de données. Tu peux tout exporter ou tout supprimer depuis ton compte.",
  },
  {
    q: "Ça marche sur quoi ?",
    r: "Dans le navigateur, sur ordinateur, iPad et téléphone. L'appli iPhone et Android arrive bientôt, avec les mêmes cartes et le rappel du jour.",
  },
];

export default function Accueil() {
  return (
    <main className="flex-1 flex flex-col overflow-x-clip">
      <header className="sticky top-0 z-30 px-5 md:px-12 py-4 flex items-center justify-between gap-4 bg-fond/70 backdrop-blur-xl border-b border-white/[0.04]">
        <Link href="/" className="titre italic text-3xl champagne leading-none">
          anima
        </Link>
        <nav aria-label="Sections" className="hidden lg:flex items-center gap-8 text-sm text-doux whitespace-nowrap">
          <a href="#comment" className="hover:text-texte transition-colors">
            Comment ça marche
          </a>
          <a href="#espaces" className="hover:text-texte transition-colors">
            Tout Anima
          </a>
          <a href="#prive" className="hover:text-texte transition-colors">
            Vie privée
          </a>
          <a href="#questions" className="hover:text-texte transition-colors">
            Questions
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/connexion" className="text-sm font-medium px-2 whitespace-nowrap underline-offset-4 hover:underline">
            Se connecter
          </Link>
          <Link href="/connexion" className={`${btn} !h-10 !px-4`}>
            Commencer
          </Link>
        </div>
      </header>

      {/* ───── En-tête : la promesse et la démo qu'on peut toucher ───── */}
      <section className="px-5 md:px-12 pt-14 md:pt-20 pb-16 md:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-10 items-center max-w-7xl w-full mx-auto">
        <div className="flex flex-col gap-7">
          <p className="surtitre">Anima Flashcards</p>
          <h1 className="titre text-[52px] sm:text-6xl md:text-7xl xl:text-[84px] leading-[0.98]">
            <span className="mot">Retiens</span> <span className="mot [animation-delay:.08s]">tout</span>
            <br />
            <em className="italic champagne pr-3">
              <span className="mot [animation-delay:.18s]">ce</span> <span className="mot [animation-delay:.24s]">que</span>{" "}
              <span className="mot [animation-delay:.3s]">tu</span> <span className="mot [animation-delay:.36s]">apprends.</span>
            </em>
          </h1>
          <p className="text-lg md:text-xl text-doux max-w-xl leading-relaxed">
            Colle ton cours, Anima en fait des flashcards. Tu révises dix minutes par jour, au bon moment, seul ou avec ta promo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/connexion" className={`${btn} bouton-or !h-12 !px-7 !text-[15px]`}>
              Créer mes premières cartes
            </Link>
            <a href="#comment" className={`${btnGhost} !h-12 !px-6`}>
              Voir comment ça marche
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-doux">
            <li className="flex items-center gap-2">
              <span className="text-champagne">✓</span> Gratuit
            </li>
            <li className="flex items-center gap-2">
              <span className="text-champagne">✓</span> Sans publicité
            </li>
            <li className="flex items-center gap-2">
              <span className="text-champagne">✓</span> Hébergé en Europe
            </li>
          </ul>
        </div>
        <DemoCarte />
      </section>

      {/* ───── Bandeau des matières qui défile ───── */}
      <div className="relative overflow-hidden border-y border-white/[0.05] py-5 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" aria-hidden>
        <div className="defile flex w-max gap-10 pr-10">
          {[...MATIERES, ...MATIERES].map((m, k) => (
            <span key={k} className="titre italic text-2xl md:text-3xl text-doux/70 whitespace-nowrap">
              {m} <span className="text-champagne/60 not-italic ml-10">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ───── Comment ça marche : trois gestes ───── */}
      <section id="comment" className="scroll-mt-24 px-5 md:px-12 py-20 md:py-28 max-w-7xl w-full mx-auto flex flex-col gap-12">
        <Revele className="max-w-2xl flex flex-col gap-4">
          <p className="surtitre">Comment ça marche</p>
          <h2 className="titre text-4xl md:text-6xl leading-[1.05]">
            Trois gestes, <em className="italic champagne">et c&apos;est su.</em>
          </h2>
        </Revele>
        <ol className="grid md:grid-cols-3 gap-5">
          <Revele as="li" className="rounded-3xl bg-papier border border-trait p-6 md:p-7 flex flex-col gap-5 souleve">
            <Etape n="1" titre="Colle ton cours" texte="Un cours, une note, un PDF. Anima propose des questions courtes et justes, et tu gardes celles qui te plaisent." />
            <div className="rounded-2xl bg-black/30 border border-white/[0.05] p-4 text-[13px] leading-relaxed text-doux" aria-hidden>
              La <mark className="bg-champagne/15 text-champagne rounded px-1">glycolyse</mark> se déroule dans le{" "}
              <mark className="bg-champagne/15 text-champagne rounded px-1">cytoplasme</mark> et produit deux molécules d&apos;
              <mark className="bg-champagne/15 text-champagne rounded px-1">ATP</mark>…
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Où se déroule la glycolyse ?", "Combien d'ATP ?"].map((t) => (
                  <span key={t} className="rounded-full border border-champagne/30 bg-champagne/[0.06] px-2.5 py-1 text-[11px] text-texte">
                    + {t}
                  </span>
                ))}
              </div>
            </div>
          </Revele>
          <Revele as="li" delai={120} className="rounded-3xl bg-papier border border-trait p-6 md:p-7 flex flex-col gap-5 souleve">
            <Etape n="2" titre="Révise dix minutes" texte="Chaque jour, Anima te dit quoi revoir. Ce qui résiste revient vite, ce que tu sais revient plus tard." />
            <div className="rounded-2xl bg-black/30 border border-white/[0.05] p-4 flex flex-col gap-3" aria-hidden>
              {[
                ["Lun", 0.35],
                ["Mar", 0.6],
                ["Mer", 0.8],
                ["Jeu", 0.55],
                ["Ven", 0.95],
              ].map(([j, v], k) => (
                <div key={j} className="flex items-center gap-3 text-[12px] text-doux">
                  <span className="w-7">{j}</span>
                  <span className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <span className="block h-full rounded-full bg-[linear-gradient(90deg,#b98e52,#f3dcb0)] jauge" style={{ width: `${Number(v) * 100}%`, animationDelay: `${k * 0.12}s` }} />
                  </span>
                </div>
              ))}
            </div>
          </Revele>
          <Revele as="li" delai={240} className="rounded-3xl bg-papier border border-trait p-6 md:p-7 flex flex-col gap-5 souleve">
            <Etape n="3" titre="Partage avec ta promo" texte="Un code de six lettres, et tout le monde révise le même paquet. Chacun garde ses propres progrès." />
            <div className="rounded-2xl bg-black/30 border border-white/[0.05] p-4 flex flex-col items-center gap-3" aria-hidden>
              <span className="surtitre">Code du paquet</span>
              <span className="titre text-4xl tracking-[0.18em] champagne">K7M-Q2P</span>
              <span className="flex -space-x-2">
                {["#8a6a45", "#4b5560", "#c2a273", "#6b6358", "#8fb39a"].map((c) => (
                  <span key={c} className="w-7 h-7 rounded-full border-2 border-[#141415]" style={{ background: c }} />
                ))}
              </span>
            </div>
          </Revele>
        </ol>
      </section>

      {/* ───── Tout Anima ───── */}
      <section id="espaces" className="scroll-mt-24 px-5 md:px-12 py-20 md:py-28 max-w-7xl w-full mx-auto flex flex-col gap-12">
        <Revele className="max-w-2xl flex flex-col gap-4">
          <p className="surtitre">Tout Anima</p>
          <h2 className="titre text-4xl md:text-6xl leading-[1.05]">
            Ta vie d&apos;étudiant, <em className="italic champagne">au même endroit.</em>
          </h2>
          <p className="text-lg text-doux leading-relaxed">Les cartes d&apos;abord, et tout ce qui va avec : tes notes, ton agenda, ton journal, tes lectures.</p>
        </Revele>
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {ESPACES.map(({ Icone, nom, texte }, k) => (
            <Revele as="li" key={nom} delai={(k % 4) * 80} className="rounded-3xl bg-papier border border-trait p-5 md:p-6 flex flex-col gap-3 souleve">
              <span className="w-11 h-11 rounded-2xl bg-champagne/[0.08] border border-champagne/20 text-champagne flex items-center justify-center">
                <Icone size={20} />
              </span>
              <h3 className="titre text-2xl leading-tight">{nom}</h3>
              <p className="text-sm text-doux leading-relaxed">{texte}</p>
            </Revele>
          ))}
        </ul>
      </section>

      {/* ───── Vie privée ───── */}
      <section id="prive" className="scroll-mt-24 px-5 md:px-12 py-20 md:py-28 max-w-7xl w-full mx-auto">
        <Revele className="relative overflow-hidden rounded-[36px] border border-trait bg-[#121213] p-8 md:p-14 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="halo" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="voile !bg-[linear-gradient(90deg,rgba(12,12,13,.92),rgba(12,12,13,.7))]" aria-hidden />
          <div className="relative flex flex-col gap-5">
            <span className="w-12 h-12 rounded-2xl bg-champagne/10 border border-champagne/25 text-champagne flex items-center justify-center">
              <IconCadenas size={22} />
            </span>
            <h2 className="titre text-4xl md:text-6xl leading-[1.05]">
              Privé, <em className="italic champagne">pour de vrai.</em>
            </h2>
            <p className="text-lg text-doux leading-relaxed max-w-md">Ce que tu écris t&apos;appartient. On le garde en Europe, on ne le montre à personne, et on ne vit pas de la pub.</p>
          </div>
          <ul className="relative grid sm:grid-cols-2 gap-3">
            {[
              ["Hébergé en Europe", "Serveurs dans l'Union européenne, sous le RGPD."],
              ["Zéro publicité", "Ni pub, ni revente de tes données."],
              ["Privé par défaut", "Rien n'est public sans ton geste. Le journal intime, jamais."],
              ["À toi, toujours", "Exporte ou supprime tout en un clic."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-white/[0.07] bg-black/30 backdrop-blur p-5 flex flex-col gap-1.5">
                <span className="font-medium">{t}</span>
                <span className="text-sm text-doux leading-relaxed">{d}</span>
              </li>
            ))}
          </ul>
        </Revele>
      </section>

      {/* ───── Questions ───── */}
      <section id="questions" className="scroll-mt-24 px-5 md:px-12 py-20 md:py-28 max-w-3xl w-full mx-auto flex flex-col gap-10">
        <Revele className="flex flex-col gap-4 text-center items-center">
          <p className="surtitre">Questions</p>
          <h2 className="titre text-4xl md:text-6xl leading-[1.05]">
            Bonnes <em className="italic champagne">questions.</em>
          </h2>
        </Revele>
        <div className="flex flex-col gap-3">
          {QUESTIONS.map(({ q, r }, k) => (
            <Revele key={q} delai={k * 50}>
              <details className="faq group rounded-2xl bg-papier border border-trait open:border-champagne/25 transition-colors">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 md:px-6 py-5 text-[17px] font-medium">
                  {q}
                  <span className="faq-signe text-2xl leading-none text-champagne transition-transform duration-300" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="px-5 md:px-6 pb-5 -mt-1 text-doux leading-relaxed">{r}</p>
              </details>
            </Revele>
          ))}
        </div>
      </section>

      {/* ───── Dernier appel ───── */}
      <section className="px-5 md:px-12 pt-10 pb-24 md:pb-32 max-w-7xl w-full mx-auto">
        <Revele className="relative overflow-hidden rounded-[36px] border border-champagne/20 bg-[radial-gradient(circle_at_20%_0%,rgba(138,106,69,.4),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(75,85,96,.45),transparent_55%),#121213] px-6 py-16 md:py-24 flex flex-col items-center text-center gap-7">
          <h2 className="titre text-5xl md:text-7xl leading-[1.02] max-w-3xl">
            Tes partiels, <em className="italic champagne">sans le stress.</em>
          </h2>
          <p className="text-lg text-doux max-w-lg leading-relaxed">Crée ton compte en trente secondes avec ton adresse e-mail. Pas de mot de passe à retenir.</p>
          <Link href="/connexion" className={`${btn} bouton-or !h-12 !px-8 !text-[15px]`}>
            Commencer gratuitement
          </Link>
        </Revele>
      </section>

      <LegalFooter />
    </main>
  );
}

function Etape({ n, titre, texte }: { n: string; titre: string; texte: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="titre italic text-5xl champagne leading-none">{n}</span>
      <h3 className="titre text-[28px] leading-tight">{titre}</h3>
      <p className="text-sm text-doux leading-relaxed">{texte}</p>
    </div>
  );
}
