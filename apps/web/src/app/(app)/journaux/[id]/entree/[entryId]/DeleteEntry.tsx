"use client";
import { useFormStatus } from "react-dom";
import { deleteEntry } from "../../ecrire/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-sm text-terre underline underline-offset-4 disabled:opacity-50">
      {pending ? "Suppression…" : "Supprimer cette entrée"}
    </button>
  );
}

/** Suppression définitive, après confirmation : l'entrée et ses photos disparaissent. */
export function DeleteEntry({ journalId, entryId }: { journalId: string; entryId: string }) {
  return (
    <form
      action={deleteEntry}
      onSubmit={(e) => {
        if (!confirm("Supprimer définitivement cette entrée et ses photos ? On ne pourra pas la récupérer.")) e.preventDefault();
      }}
      className="border-t border-trait pt-6">
      <input type="hidden" name="journalId" value={journalId} />
      <input type="hidden" name="entryId" value={entryId} />
      <Submit />
    </form>
  );
}
