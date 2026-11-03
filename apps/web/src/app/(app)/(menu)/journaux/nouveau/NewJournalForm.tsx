"use client";
import { useActionState, useState } from "react";
import { COVERS, JOURNAL_KIND_LABELS, SHARED_JOURNAL_KINDS, type JournalKind } from "@anima/core";
import { createSharedJournal, type FormState } from "../actions";
import { btn, input } from "@/components/ui";
import { Cover } from "@/components/Cover";

export function NewJournalForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSharedJournal, {});
  const [cover, setCover] = useState<string>(COVERS[0].id);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<JournalKind>(SHARED_JOURNAL_KINDS[0]);
  return (
    <form action={action} className="flex flex-col gap-8">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Titre</span>
        <input name="title" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nous deux, Coloc, Voyage au Japon…" className={input} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium mb-3">Pour qui ?</legend>
        <div className="flex flex-wrap gap-2">
          {SHARED_JOURNAL_KINDS.map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
              <span className="inline-flex h-10 px-4 items-center rounded-full border border-trait text-sm peer-checked:bg-accent peer-checked:text-accent-texte peer-checked:border-accent peer-focus-visible:outline-2">
                {JOURNAL_KIND_LABELS[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium mb-3">Couverture</legend>
        <div className="flex flex-wrap gap-5">
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
              <span className="block rounded-[4px_10px_10px_4px] peer-checked:ring-2 peer-checked:ring-noir peer-checked:ring-offset-4 peer-checked:ring-offset-fond peer-focus-visible:ring-2">
                <Cover cover={c.id} title={title.trim() || "Nous deux"} kind={kind} className="w-24" />
              </span>
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
