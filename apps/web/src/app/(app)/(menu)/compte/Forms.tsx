"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { deleteAccount, saveAiAccess, updateName, type SimpleState } from "./actions";
import { btn, input } from "@/components/ui";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(updateName, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-2 flex-1 min-w-56">
        <span className="text-sm font-medium">Prénom affiché aux membres de tes journaux</span>
        <input name="displayName" defaultValue={name} maxLength={60} required className={input} />
      </label>
      <button type="submit" className={btn} disabled={pending}>
        Enregistrer
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-terre">{state.error}</p>}
      {state.ok && <p role="status" className="w-full text-sm text-doux">C'est enregistré.</p>}
    </form>
  );
}

export function DeleteForm() {
  const [state, action, pending] = useActionState<SimpleState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-2">
        <span className="text-sm">
          Écris <b>SUPPRIMER</b> pour confirmer.
        </span>
        <input name="confirm" autoComplete="off" className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-terre">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={`${btn} !bg-terre !text-blanc`}>
          {pending ? "Suppression…" : "Supprimer définitivement mon compte"}
        </button>
      </div>
    </form>
  );
}

export function AiAccessForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(saveAiAccess, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btn} disabled={pending}>
          Enregistrer
        </button>
        {state.error && <p role="alert" className="text-sm text-terre">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-doux">C'est enregistré.</p>}
      </div>
    </form>
  );
}
