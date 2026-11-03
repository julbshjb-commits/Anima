import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { LegalFooter } from "@/components/LegalPage";
import { MenuLinks, SettingsLink } from "@/components/MenuLinks";
import { IconCoche, IconJournaux, IconNotes, IconReglages, IconSoleil } from "@/components/icons";

/** Écrans de navigation (journaux, rejoindre, compte) : barre latérale des maquettes. */
export default function MenuLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      <nav
        aria-label="Navigation principale"
        className="hidden lg:flex w-[264px] shrink-0 sticky top-0 h-dvh flex-col gap-7 px-5 py-7 border-r border-trait"
      >
        <Link href="/aujourdhui" className="titre text-[30px] leading-none px-2.5">
          Anima
        </Link>
        <MenuLinks />
        <div className="mt-auto flex flex-col gap-0.5">
          <SettingsLink />
          <Suspense fallback={<div className="h-[52px]" />}>
            <Me />
          </Suspense>
        </div>
      </nav>

      <header className="lg:hidden sticky top-0 z-10 h-14 px-4 flex items-center gap-2 border-b border-trait bg-fond/90 backdrop-blur">
        <Link href="/aujourdhui" className="titre text-2xl mr-auto">
          Anima
        </Link>
        <Link href="/aujourdhui" aria-label="Aujourd'hui" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconSoleil />
        </Link>
        <Link href="/journaux" aria-label="Journaux" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconJournaux />
        </Link>
        <Link href="/organiser" aria-label="Organiser" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconCoche />
        </Link>
        <Link href="/notes" aria-label="Notes" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconNotes />
        </Link>
        <Link href="/compte" aria-label="Réglages" className="w-10 h-10 grid place-items-center rounded-full hover:bg-lin">
          <IconReglages />
        </Link>
      </header>

      <div className="flex-1 min-w-0 flex flex-col">
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
    <Link href="/compte" className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-lin">
      <Avatar name={name} />
      <span className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{name}</span>
        <span className="text-xs text-doux truncate">{user.email}</span>
      </span>
    </Link>
  );
}
