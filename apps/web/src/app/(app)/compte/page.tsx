import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { btnGhost, card } from "@/components/ui";
import { DeleteForm, NameForm } from "./Forms";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Compte" };

export default function ComptePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 flex flex-col gap-10">
      <h1 className="titre text-5xl">Ton compte</h1>
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Compte />
      </Suspense>
    </main>
  );
}

async function Compte() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const canDelete = adminClient() !== null;
  return (
    <>
      <section className={`${card} p-6 flex flex-col gap-4`}>
        <p className="text-sm text-doux">Connecté avec {user.email}</p>
        <NameForm name={profile?.display_name ?? ""} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="surtitre">Tes données</h2>
        <p className="text-sm text-doux leading-relaxed">
          Tes journaux sont hébergés dans l'Union européenne. Tu peux télécharger à tout moment tout ce que tu as écrit.
        </p>
        <div>
          <a href="/compte/export" className={btnGhost}>
            Télécharger mes données (JSON)
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="surtitre">Session</h2>
        <form action={signOut}>
          <button type="submit" className={btnGhost}>
            Se déconnecter
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 pt-6 border-t border-trait">
        <h2 className="surtitre">Supprimer le compte</h2>
        <p className="text-sm text-doux leading-relaxed">
          Ton journal intime, tes entrées et tes photos sont effacés. Les journaux partagés que tu as créés restent à leurs
          autres membres : le plus ancien en devient le propriétaire.
        </p>
        {canDelete ? (
          <DeleteForm />
        ) : (
          <p className="text-sm text-doux">
            La suppression en un clic sera disponible dès que le serveur sera entièrement configuré. En attendant,
            écris-nous et nous supprimerons ton compte.
          </p>
        )}
      </section>
    </>
  );
}
