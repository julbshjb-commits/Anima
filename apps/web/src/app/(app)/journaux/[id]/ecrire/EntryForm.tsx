"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MOODS, MOOD_META } from "@anima/core";
import { createEntry } from "./actions";
import { browserClient } from "@/lib/supabase/browser";
import { btn, input } from "@/components/ui";

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
const MAX_PHOTO = 10 * 1024 * 1024;
const MAX_PHOTOS = 4;

export function EntryForm({ journalId, date, userId }: { journalId: string; date: string; userId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (photos.length > MAX_PHOTOS) return setError(`${MAX_PHOTOS} photos maximum par entrée.`);
    for (const p of photos) {
      if (!PHOTO_TYPES[p.type]) return setError("Formats acceptés : JPEG, PNG, WebP, HEIC.");
      if (p.size > MAX_PHOTO) return setError("Chaque photo doit faire moins de 10 Mo.");
    }
    setError(undefined);

    startTransition(async () => {
      setStep("Enregistrement…");
      const entryDate = String(form.get("entryDate"));
      const res = await createEntry({
        journalId,
        entryDate,
        title: String(form.get("title") ?? ""),
        contentText: String(form.get("contentText") ?? ""),
        mood: (form.get("mood") as string | null) || null,
      });
      if ("error" in res) {
        setStep(undefined);
        setError(res.error);
        return;
      }

      let failed = 0;
      const supabase = browserClient();
      for (const [i, p] of photos.entries()) {
        setStep(`Envoi de la photo ${i + 1} sur ${photos.length}…`);
        const path = `${journalId}/${res.entryId}/${crypto.randomUUID()}.${PHOTO_TYPES[p.type]}`;
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
              <input type="radio" name="mood" value={m} className="peer sr-only" />
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
        maxLength={120}
        placeholder="Un titre, si tu veux"
        aria-label="Titre"
        className="titre text-4xl bg-transparent border-0 border-b border-trait pb-2 focus:outline-none focus:border-texte placeholder:text-doux"
      />
      <textarea
        name="contentText"
        required
        maxLength={50000}
        rows={12}
        aria-label="Ton entrée"
        placeholder="Qu'est-ce qui a compté aujourd'hui ?"
        className="w-full bg-surface border border-trait rounded-2xl p-5 text-lg leading-relaxed focus:outline-none focus:border-texte placeholder:text-doux resize-y"
      />

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Photos (4 maximum, 10 Mo chacune)</span>
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
          {pending ? "Enregistrement…" : "Enregistrer l'entrée"}
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
