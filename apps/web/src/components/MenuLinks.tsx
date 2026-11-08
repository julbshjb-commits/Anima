"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBibliotheque, IconCartes, IconCercles, IconCle, IconCoche, IconDossier, IconJournaux, IconNotes, IconReglages, IconSoleil } from "./icons";

const LINKS = [
  { href: "/flashcards", label: "Flashcards", Icon: IconCartes, match: (p: string) => p.startsWith("/flashcards") },
  { href: "/notes", label: "Notes de cours", tab: "Cours", Icon: IconNotes, match: (p: string) => p.startsWith("/notes") },
  { href: "/aujourdhui", label: "Aujourd'hui", Icon: IconSoleil, match: (p: string) => p.startsWith("/aujourdhui") },
  { href: "/journaux", label: "Journaux", Icon: IconJournaux, match: (p: string) => p.startsWith("/journaux") },
  { href: "/organiser", label: "Organiser", Icon: IconCoche, match: (p: string) => p.startsWith("/organiser") },
  { href: "/cercles", label: "Cercles", Icon: IconCercles, match: (p: string) => p.startsWith("/cercles") },
  { href: "/bibliotheque", label: "Bibliothèque", Icon: IconBibliotheque, match: (p: string) => p.startsWith("/bibliotheque") },
  { href: "/fichiers", label: "Fichiers", Icon: IconDossier, match: (p: string) => p.startsWith("/fichiers") },
  { href: "/rejoindre", label: "Rejoindre avec un code", Icon: IconCle, match: (p: string) => p.startsWith("/rejoindre") },
] as const;

/** Les flashcards sont le cœur d'Anima ; le reste vient « en plus ». */
const MAIN = LINKS.slice(0, 2);
const MORE = LINKS.slice(2);

const item = "relative flex items-center gap-3 h-11 px-3 rounded-2xl text-sm transition-[background-color,transform] duration-200 active:scale-[.97]";
const active = "bg-papier text-noir font-medium";
const idle = "text-encre hover:bg-lin hover:translate-x-0.5";

/** Liens de la barre latérale : seules les rubriques qui existent vraiment. */
export function MenuLinks() {
  const path = usePathname();
  const row = ({ href, label, Icon, match }: (typeof LINKS)[number]) => (
    <Link key={href} href={href} aria-current={match(path) ? "page" : undefined} className={`${item} ${match(path) ? active : idle}`}>
      <Icon />
      {label}
      {match(path) && <span aria-hidden className="ml-auto w-1.5 h-1.5 rounded-full bg-champagne shadow-[0_0_10px_rgba(230,200,145,.8)]" />}
    </Link>
  );
  return (
    <div className="flex flex-col gap-0.5">
      {MAIN.map(row)}
      <p className="surtitre px-3 pt-6 pb-2">Aussi dans Anima</p>
      {MORE.map(row)}
    </div>
  );
}

const TABS = [LINKS[0], LINKS[1], LINKS[2], LINKS[3], LINKS[5]] as const;

/** Barre d'onglets flottante (téléphone et iPad en portrait). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Rubriques"
      className="lg:hidden fixed z-20 left-1/2 -translate-x-1/2 bottom-[max(12px,env(safe-area-inset-bottom))] w-[calc(100%-24px)] max-w-[560px] h-[66px] px-2 rounded-[24px] bg-[rgba(20,17,26,.86)] backdrop-blur-xl border border-trait shadow-[0_24px_50px_-20px_rgba(0,0,0,.9)] grid grid-cols-5 items-center"
    >
      {TABS.map((l) => {
        const { href, Icon, match } = l;
        const label = "tab" in l ? l.tab : l.label;
        const on = match(path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`relative h-full flex flex-col items-center justify-center gap-1 text-[10.5px] md:text-xs transition-transform active:scale-90 ${on ? "text-noir font-medium" : "text-doux"}`}
          >
            <span className={`grid place-items-center w-10 h-8 rounded-full transition-colors ${on ? "bg-[linear-gradient(180deg,#f0d8a8,#d4ad6c)] text-nuit" : ""}`}>
              <Icon />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsLink() {
  const path = usePathname();
  const on = path.startsWith("/compte");
  return (
    <Link href="/compte" aria-current={on ? "page" : undefined} className={`${item} ${on ? active : idle}`}>
      <IconReglages />
      Réglages
    </Link>
  );
}
