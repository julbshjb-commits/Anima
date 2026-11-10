import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { suggestHandle } from "@anima/core";
import { getMe } from "@/lib/reseau";
import { LeaveNetworkForm, ProfileForm } from "@/components/social/Client";
import { ProfilePic } from "@/components/social/ProfilePic";
import { card } from "@/components/ui";
import { unblock } from "../actions";

export const metadata: Metadata = { title: "Mon profil public" };

export default function ProfilPage() {
  return (
    <main className="max-w-2xl px-5 py-8 lg:px-12 lg:pt-10 flex flex-col gap-8">
      <Suspense fallback={<p className="text-doux">Chargement…</p>}>
        <Profil />
      </Suspense>
    </main>
  );
}

async function Profil() {
  const { supabase, user, me } = await getMe();
  const { data: priv } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = priv?.display_name ?? user.email?.split("@")[0] ?? "";
  const { data: blocked } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
  const ids = (blocked ?? []).map((b) => b.blocked_id);
  const { data: people } = ids.length ? await supabase.from("public_profiles").select("id, handle, name").in("id", ids) : { data: [] };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="surtitre">{me ? "Réseau Anima" : "Bienvenue sur le réseau"}</p>
        <h1 className="titre text-[44px] leading-[1.05]">{me ? "Mon profil public" : "Ton profil public"}</h1>
        {!me && (
          <p className="text-doux leading-relaxed max-w-lg">
            C&apos;est ce que verront les autres. Il est séparé de ton compte : ton prénom privé, tes journaux et tes notes restent à toi.
          </p>
        )}
      </div>
      <section className={`${card} p-6 sm:p-8`}>
        <ProfileForm
          userId={user.id}
          initial={me ? { handle: me.handle, name: me.name, bio: me.bio, is_private: me.is_private, avatar: me.avatar } : null}
          suggested={{ handle: suggestHandle(name), name }}
        />
      </section>
      {me && (
        <>
          <Link href={`/u/${me.handle}`} className="text-sm underline underline-offset-4 self-start">
            Voir mon profil comme les autres le voient
          </Link>
          {(people ?? []).length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="surtitre">Personnes bloquées</h2>
              {(people ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <ProfilePic name={p.name} handle={p.handle} src={null} size={32} />
                  <span className="flex-1 text-sm">
                    {p.name} <span className="text-doux">@{p.handle}</span>
                  </span>
                  <form action={unblock}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-sm underline underline-offset-4">Débloquer</button>
                  </form>
                </div>
              ))}
            </section>
          )}
          <section className="flex flex-col gap-3 pt-6 border-t border-trait">
            <h2 className="surtitre">Quitter le réseau</h2>
            <LeaveNetworkForm />
          </section>
        </>
      )}
    </>
  );
}
