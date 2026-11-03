import Link from "next/link";
import { supabaseEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { LegalFooter } from "@/components/LegalPage";

export default function AppLayout({ children }: LayoutProps<"/">) {
  if (!supabaseEnv()) return <NotConfigured />;
  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 bg-fond/90 backdrop-blur border-b border-trait">
        <nav aria-label="Navigation principale" className="mx-auto max-w-6xl px-5 h-16 flex items-center gap-6">
          <Link href="/journaux" className="titre text-2xl mr-auto">
            Anima
          </Link>
          <Link href="/journaux" className="text-sm hover:underline underline-offset-4">
            Journaux
          </Link>
          <Link href="/rejoindre" className="text-sm hover:underline underline-offset-4">
            Rejoindre
          </Link>
          <Link href="/compte" className="text-sm hover:underline underline-offset-4">
            Compte
          </Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
      <LegalFooter />
    </div>
  );
}
