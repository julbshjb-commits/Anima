"use client";
import { useActionState, type ReactNode } from "react";
import { btn, btnGhost } from "@/components/ui";
import { decide, type ConsentState } from "./actions";

export function ConsentForm({ authorizationId, children }: { authorizationId: string; children: ReactNode }) {
  const [state, action, pending] = useActionState<ConsentState, FormData>(decide, {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="authorizationId" value={authorizationId} />
      {children}
      {state.error && (
        <p role="alert" className="text-sm text-terre">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="decision" value="approve" disabled={pending} className={btn}>
          Autoriser
        </button>
        <button type="submit" name="decision" value="deny" disabled={pending} className={btnGhost}>
          Refuser
        </button>
      </div>
    </form>
  );
}
