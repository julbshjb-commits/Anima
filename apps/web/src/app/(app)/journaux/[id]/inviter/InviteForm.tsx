"use client";
import { useActionState, useState } from "react";
import { formatInviteCode } from "@anima/core";
import { createInvite, type InviteState } from "./actions";
import { btn, btnGhost, card } from "@/components/ui";

export function InviteForm({ journalId, title }: { journalId: string; title: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);
  const message = state.code
    ? `Rejoins notre journal « ${title} » sur Anima avec le code ${formatInviteCode(state.code)} (valable 48 h).`
    : "";

  return (
    <div className="flex flex-col gap-6">
      {state.code ? (
        <div className={`${card} p-8 flex flex-col items-start gap-4`}>
          <p className="surtitre">Code d'invitation</p>
          <p className="titre text-6xl tracking-[0.12em] tabular-nums select-all">{formatInviteCode(state.code)}</p>
          <p className="text-sm text-doux">
            Valable 48 heures, jusqu'à 10 personnes. Il ne sera plus affiché ensuite : copie-le maintenant.
          </p>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              await navigator.clipboard.writeText(message);
              setCopied(true);
            }}
          >
            {copied ? "Message copié" : "Copier le message d'invitation"}
          </button>
        </div>
      ) : null}
      <form action={action}>
        <input type="hidden" name="journalId" value={journalId} />
        {state.error && (
          <p role="alert" className="text-sm text-terre mb-3">
            {state.error}
          </p>
        )}
        <button type="submit" className={state.code ? btnGhost : btn} disabled={pending}>
          {pending ? "Création…" : state.code ? "Générer un autre code" : "Générer un code d'invitation"}
        </button>
      </form>
    </div>
  );
}
