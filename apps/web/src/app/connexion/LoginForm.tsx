"use client";
import { useActionState } from "react";
import { sendMagicLink, type LinkState } from "./actions";
import { btn, input } from "@/components/ui";

export function LoginForm({ suite }: { suite?: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <h2 className="titre text-3xl">Regarde ta boîte mail.</h2>
        <p className="text-doux">
          Un lien de connexion vient de partir vers <b className="text-texte font-medium">{state.email}</b>. Il est
          valable une heure, à ouvrir dans ce navigateur.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="suite" value={suite ?? ""} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Ton adresse e-mail</span>
        <input name="email" type="email" required autoComplete="email" placeholder="prenom@exemple.fr" className={input} />
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-terre">
          {state.message}
        </p>
      )}
      <button type="submit" className={btn} disabled={pending}>
        {pending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
      <p className="text-xs text-doux leading-relaxed">
        Pas de mot de passe : on t'envoie un lien. Si tu n'as pas encore de compte, il est créé à ce moment-là.
      </p>
    </form>
  );
}
