"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCle, IconCoche, IconJournaux, IconReglages, IconSoleil } from "./icons";

const LINKS = [
  { href: "/aujourdhui", label: "Aujourd'hui", Icon: IconSoleil, match: (p: string) => p.startsWith("/aujourdhui") },
  { href: "/journaux", label: "Journaux", Icon: IconJournaux, match: (p: string) => p.startsWith("/journaux") },
  { href: "/organiser", label: "Organiser", Icon: IconCoche, match: (p: string) => p.startsWith("/organiser") },
  { href: "/rejoindre", label: "Rejoindre un journal", Icon: IconCle, match: (p: string) => p.startsWith("/rejoindre") },
] as const;

const item = "flex items-center gap-3 h-10 px-2.5 rounded-lg text-sm";
const active = "bg-papier shadow-[0_0_0_1px_rgba(21,21,21,.08)] text-noir font-medium";
const idle = "text-encre hover:bg-lin";

/** Liens de la barre latérale : seules les rubriques qui existent vraiment. */
export function MenuLinks() {
  const path = usePathname();
  return (
    <div className="flex flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon, match }) => (
        <Link key={href} href={href} aria-current={match(path) ? "page" : undefined} className={`${item} ${match(path) ? active : idle}`}>
          <Icon />
          {label}
        </Link>
      ))}
    </div>
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
