import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { btnGhost, card } from "@/components/ui";
import { getAiSpaces } from "@/lib/ia";
import { AiSpacesPicker } from "@/components/AiSpacesPicker";
import { AiAccessForm, DeleteForm, NameForm } from "./Forms";
import { revokeApp, signOut } from "./actions";

export const metadata: Metadata = { title: "Réglages" };

export default function ComptePage() {
  return (
    <main className="max-w-3xl px-5 py-8 lg:px-12 lg:pt-10 flex flex-col gap-10">
      <div className="flex flex-col gap-1.5"><p className="surtitre">Ton compte</p><h1 className="titre text-[44px] leading-[1.05]">Réglages</h1></div>
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
  const [aiSpaces, grants] = await Promise.all([getAiSpaces(supabase, user.id), supabase.auth.oauth.listGrants()]);
  const apps = grants.data ?? [];
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

      <section className="flex flex-col gap-3" id="assistants">
        <h2 className="surtitre">Claude et les assistants IA</h2>
        <p className="text-sm text-doux leading-relaxed">
          Tu peux relier Anima à Claude (comme Notion) pour qu'il lise et ajoute des éléments à ta place. Il ne voit que les
          espaces cochés ici. Rien n'est ouvert sans ton accord.
        </p>
        <div className={`${card} p-6`}>
          <AiAccessForm>
            <AiSpacesPicker selected={aiSpaces} />
          </AiAccessForm>
        </div>
        {apps.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {apps.map((g) => (
              <li key={g.client.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  <b>{g.client.name || "Appli sans nom"}</b>{" "}
                  <span className="text-doux">reliée le {new Date(g.granted_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</span>
                </span>
                <form action={revokeApp}>
                  <input type="hidden" name="clientId" value={g.client.id} />
                  <button type="submit" className="text-sm text-terre underline underline-offset-4">
                    Retirer l'accès
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-doux">Aucune appli reliée pour l'instant.</p>
        )}
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
