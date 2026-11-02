import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getJournal } from "@/lib/data";
import { card } from "@/components/ui";
import { InviteForm } from "./InviteForm";
import { revokeInvite } from "./actions";

export const metadata: Metadata = { title: "Inviter" };

export default function InviterPage(props: PageProps<"/journaux/[id]/inviter">) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Inviter {...props} />
      </Suspense>
    </main>
  );
}

const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" });

async function Inviter({ params }: PageProps<"/journaux/[id]/inviter">) {
  const { id } = await params;
  const { supabase, journal, members, myRole, user } = await getJournal(id);
  // Le journal intime ne se partage jamais (refusé aussi par la base).
  if (journal.kind === "intime" || myRole === "reader") notFound();

  const { data: invites } = await supabase
    .from("journal_invites")
    .select("id, expires_at, uses, max_uses, created_by")
    .eq("journal_id", journal.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href={`/journaux/${journal.id}`} className="text-sm text-doux hover:underline underline-offset-4">
          ← {journal.title}
        </Link>
        <h1 className="titre text-5xl">Inviter dans « {journal.title} »</h1>
        <p className="text-doux">
          Envoie le code à la personne de ton choix. Elle le saisit dans Anima, rubrique « Rejoindre ».
        </p>
      </div>

      <InviteForm journalId={journal.id} title={journal.title} />

      {invites && invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="surtitre">Codes encore actifs</h2>
          <ul className="flex flex-col gap-2">
            {invites.map((inv) => (
              <li key={inv.id} className={`${card} px-5 py-4 flex items-center gap-4 text-sm`}>
                <span className="flex-1">
                  Expire {fmt.format(new Date(inv.expires_at))} · utilisé {inv.uses} fois sur {inv.max_uses}
                  {inv.created_by === user.id ? "" : " · créé par un autre membre"}
                </span>
                <form action={revokeInvite}>
                  <input type="hidden" name="inviteId" value={inv.id} />
                  <input type="hidden" name="journalId" value={journal.id} />
                  <button type="submit" className="text-terre hover:underline underline-offset-4">
                    Désactiver
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="surtitre">Membres</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-surface-2 grid place-items-center text-xs font-semibold">
                {m.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1">{m.id === user.id ? `${m.display_name} (toi)` : m.display_name}</span>
              <span className="text-doux">{m.role === "owner" ? "créateur" : m.role === "editor" ? "écrit" : "lit"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
