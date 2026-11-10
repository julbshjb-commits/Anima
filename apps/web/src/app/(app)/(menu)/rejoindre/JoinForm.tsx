"use client";
import { useActionState } from "react";
import { joinWithCode, type JoinState } from "./actions";
import { btn } from "@/components/ui";

export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinWithCode, {});
  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Code d'invitation</span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          placeholder="K7M-Q2P"
          className="h-16 px-5 rounded-xl bg-surface border border-trait titre text-4xl tracking-[0.15em] uppercase focus:outline-none focus:border-texte placeholder:text-doux/50"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-terre">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" className={btn} disabled={pending}>
          {pending ? "Vérification…" : "Rejoindre"}
        </button>
      </div>
    </form>
  );
}
