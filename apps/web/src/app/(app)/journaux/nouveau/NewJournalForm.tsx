"use client";
import { useActionState, useState } from "react";
import { COVERS, JOURNAL_KIND_LABELS, SHARED_JOURNAL_KINDS } from "@anima/core";
import { createSharedJournal, type FormState } from "../actions";
import { btn, input } from "@/components/ui";

export function NewJournalForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSharedJournal, {});
  const [cover, setCover] = useState<string>(COVERS[0].id);
  return (
    <form action={action} className="flex flex-col gap-8">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Titre</span>
        <input name="title" required maxLength={80} placeholder="Nous deux, Coloc, Voyage au Japon…" className={input} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium mb-3">Pour qui ?</legend>
        <div className="flex flex-wrap gap-2">
          {SHARED_JOURNAL_KINDS.map((k, i) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="peer sr-only" />
              <span className="inline-flex h-10 px-4 items-center rounded-full border border-trait text-sm peer-checked:bg-accent peer-checked:text-accent-texte peer-checked:border-accent peer-focus-visible:outline-2">
                {JOURNAL_KIND_LABELS[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium mb-3">Couverture</legend>
        <div className="flex flex-wrap gap-4">
          {COVERS.map((c) => (
            <label key={c.id} className="cursor-pointer flex flex-col items-center gap-2">
              <input
                type="radio"
                name="cover"
                value={c.id}
                checked={cover === c.id}
                onChange={() => setCover(c.id)}
                className="peer sr-only"
              />
              <span
                className="block w-14 aspect-[3/4] rounded-[2px_8px_8px_2px] shadow-[inset_4px_0_0_rgba(0,0,0,.18)] peer-checked:ring-2 peer-checked:ring-texte peer-checked:ring-offset-2 peer-checked:ring-offset-fond peer-focus-visible:ring-2"
                style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}
              />
              <span className="text-xs text-doux">{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-terre">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" className={btn} disabled={pending}>
          {pending ? "Création…" : "Créer et inviter"}
        </button>
      </div>
    </form>
  );
}
