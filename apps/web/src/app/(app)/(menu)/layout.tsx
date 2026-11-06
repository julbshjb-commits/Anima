import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { LegalFooter } from "@/components/LegalPage";
import { MenuLinks, SettingsLink, TabBar } from "@/components/MenuLinks";
import { IconBibliotheque, IconCle, IconDossier, IconReglages } from "@/components/icons";

/** Écrans de navigation (journaux, rejoindre, compte) : barre latérale des maquettes. */
export default function MenuLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <nav
        aria-label="Navigation principale"
        className="hidden lg:flex w-[264px] shrink-0 sticky top-0 h-dvh flex-col gap-7 px-5 py-7 border-r border-trait"
      >
        <Link href="/aujourdhui" className="titre italic text-[34px] leading-none px-3 champagne self-start">
          anima
        </Link>
        <MenuLinks />
        <div className="mt-auto flex flex-col gap-0.5">
          <SettingsLink />
          <Suspense fallback={<div className="h-[52px]" />}>
            <Me />
          </Suspense>
        </div>
      </nav>

      <header className="lg:hidden sticky top-0 z-10 h-14 px-4 flex items-center gap-1 border-b border-trait bg-fond/90">
        <Link href="/aujourdhui" className="titre italic text-[26px] mr-auto champagne">
          anima
        </Link>
        <Link href="/bibliotheque" aria-label="Bibliothèque" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconBibliotheque />
        </Link>
        <Link href="/fichiers" aria-label="Fichiers" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconDossier />
        </Link>
        <Link href="/rejoindre" aria-label="Rejoindre avec un code" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconCle />
        </Link>
        <Link href="/compte" aria-label="Réglages" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconReglages />
        </Link>
      </header>
      <TabBar />

      <div className="flex-1 min-w-0 flex flex-col pb-24 lg:pb-0">
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </div>
    </div>
  );
}

async function Me() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = data?.display_name || user.email?.split("@")[0] || "Moi";
  return (
    <Link href="/compte" className="flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-lin">
      <Avatar name={name} />
      <span className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{name}</span>
        <span className="text-xs text-doux truncate">{user.email}</span>
      </span>
    </Link>
  );
}
