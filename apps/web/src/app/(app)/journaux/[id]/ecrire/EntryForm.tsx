"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, MOODS, MOOD_META, PHOTO_TYPES, photoPath, type Mood } from "@anima/core";
import { createEntry, updateEntry } from "./actions";
import { browserClient } from "@/lib/supabase/browser";
import { btn, input } from "@/components/ui";

/** Entrée existante, quand le formulaire sert à la modifier. */
export type EditableEntry = {
  id: string;
  title: string | null;
  contentText: string;
  mood: Mood | null;
  photos: { id: string; url: string }[];
};

export function EntryForm({ journalId, date, userId, entry }: { journalId: string; date: string; userId: string; entry?: EditableEntry }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    const removePhotoIds = form.getAll("removePhoto").map(String);
    const kept = (entry?.photos.length ?? 0) - removePhotoIds.length;
    if (kept + photos.length > MAX_PHOTOS) return setError(`${MAX_PHOTOS} photos maximum par entrée.`);
    for (const p of photos) {
      if (!PHOTO_TYPES[p.type]) return setError("Formats acceptés : JPEG, PNG, WebP, HEIC.");
      if (p.size > MAX_PHOTO_BYTES) return setError("Chaque photo doit faire moins de 10 Mo.");
    }
    setError(undefined);

    startTransition(async () => {
      setStep("Enregistrement…");
      const entryDate = String(form.get("entryDate"));
      const fields = {
        journalId,
        entryDate,
        title: String(form.get("title") ?? ""),
        contentText: String(form.get("contentText") ?? ""),
        mood: (form.get("mood") as string | null) || null,
      };
      const res = entry ? await updateEntry({ ...fields, entryId: entry.id, removePhotoIds }) : await createEntry(fields);
      if ("error" in res) {
        setStep(undefined);
        setError(res.error);
        return;
      }

      let failed = 0;
      const supabase = browserClient();
      for (const [i, p] of photos.entries()) {
        setStep(`Envoi de la photo ${i + 1} sur ${photos.length}…`);
        const path = photoPath(journalId, res.entryId, crypto.randomUUID(), p.type);
        const up = await supabase?.storage.from("attachments").upload(path, p, { contentType: p.type });
        if (!supabase || up?.error) {
          failed++;
          continue;
        }
        const { error: attErr } = await supabase.from("attachments").insert({
          owner_id: userId,
          journal_id: journalId,
          entry_id: res.entryId,
          storage_path: path,
          mime_type: p.type,
          size_bytes: p.size,
        });
        if (attErr) {
          await supabase.storage.from("attachments").remove([path]);
          failed++;
        }
      }
      const q = new URLSearchParams({ mois: entryDate.slice(0, 7) });
      if (failed) q.set("photos", String(failed));
      router.push(`/journaux/${journalId}?${q}#${entryDate}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <label className="flex flex-col gap-2 max-w-xs">
        <span className="text-sm font-medium">Date</span>
        <input type="date" name="entryDate" defaultValue={date} required className={input} />
      </label>

      <fieldset>
        <legend className="text-sm font-medium mb-3">Comment te sens-tu ?</legend>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <label key={m} className="cursor-pointer">
              <input type="radio" name="mood" value={m} defaultChecked={entry?.mood === m} className="peer sr-only" />
              <span className="inline-flex h-10 pl-2 pr-4 gap-2 items-center rounded-full border border-trait text-sm peer-checked:border-texte peer-checked:bg-surface peer-focus-visible:outline-2">
                <span className="w-6 h-6 rounded-full" style={{ background: MOOD_META[m].color }} />
                {MOOD_META[m].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <input
        name="title"
        defaultValue={entry?.title ?? ""}
        maxLength={120}
        placeholder="Un titre, si tu veux"
        aria-label="Titre"
        className="titre text-4xl bg-transparent border-0 border-b border-trait pb-2 focus:outline-none focus:border-texte placeholder:text-doux"
      />
      <textarea
        name="contentText"
        defaultValue={entry?.contentText}
        required
        maxLength={50000}
        rows={12}
        aria-label="Ton entrée"
        placeholder="Qu'est-ce qui a compté aujourd'hui ?"
        className="w-full bg-surface border border-trait rounded-2xl p-5 text-lg leading-relaxed focus:outline-none focus:border-texte placeholder:text-doux resize-y"
      />

      {entry && entry.photos.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium mb-3">Photos déjà ajoutées (coche celles à retirer)</legend>
          <div className="flex flex-wrap gap-3">
            {entry.photos.map((p, i) => (
              <label key={p.id} className="flex flex-col items-start gap-2 text-sm cursor-pointer">
                {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="h-28 w-auto rounded-xl object-cover" />
                <span className="flex items-center gap-2">
                  <input type="checkbox" name="removePhoto" value={p.id} /> Retirer
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">{entry ? "Ajouter des photos" : "Photos"} (4 maximum au total, 10 Mo chacune)</span>
        <input
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="text-sm file:mr-4 file:h-10 file:px-4 file:rounded-full file:border file:border-trait file:bg-surface file:text-texte"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-terre">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button type="submit" className={btn} disabled={pending}>
          {pending ? "Enregistrement…" : entry ? "Enregistrer les modifications" : "Enregistrer l'entrée"}
        </button>
        {pending && step && (
          <span role="status" className="text-sm text-doux">
            {step}
          </span>
        )}
      </div>
    </form>
  );
}
