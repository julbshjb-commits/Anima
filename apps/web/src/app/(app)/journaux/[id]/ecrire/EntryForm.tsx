"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, MOODS, MOOD_META, PHOTO_TYPES, formatLongDate, photoPath, type Mood } from "@anima/core";
import { createEntry, updateEntry } from "./actions";
import { browserClient } from "@/lib/supabase/browser";
import { IconPhoto } from "@/components/icons";
import { btn } from "@/components/ui";

/** Entrée existante, quand le formulaire sert à la modifier. */
export type EditableEntry = {
  id: string;
  title: string | null;
  contentText: string;
  mood: Mood | null;
  photos: { id: string; url: string }[];
};

type Props = {
  journalId: string;
  date: string;
  userId: string;
  /** Qui verra l'entrée, affiché en haut comme dans la maquette. */
  visibility: string;
  entry?: EditableEntry;
};

/**
 * Page d'écriture, d'après la maquette « Éditeur » : barre d'état et bouton
 * Publier en haut, date, grand titre, humeurs en pastilles, texte en Cormorant.
 */
export function EntryForm({ journalId, date: initialDate, userId, visibility, entry }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(initialDate);
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    const kept = (entry?.photos.length ?? 0) - removed.length;
    if (kept + photos.length > MAX_PHOTOS) return setError(`${MAX_PHOTOS} photos maximum par entrée.`);
    for (const p of photos) {
      if (!PHOTO_TYPES[p.type]) return setError("Formats acceptés : JPEG, PNG, WebP, HEIC.");
      if (p.size > MAX_PHOTO_BYTES) return setError("Chaque photo doit faire moins de 10 Mo.");
    }
    setError(undefined);

    startTransition(async () => {
      setStep("Enregistrement…");
      const fields = {
        journalId,
        entryDate: date,
        title: String(form.get("title") ?? ""),
        contentText: String(form.get("contentText") ?? ""),
        mood,
      };
      const res = entry ? await updateEntry({ ...fields, entryId: entry.id, removePhotoIds: removed }) : await createEntry(fields);
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
      const q = new URLSearchParams({ mois: date.slice(0, 7) });
      if (failed) q.set("photos", String(failed));
      router.push(`/journaux/${journalId}?${q}#${date}`);
      router.refresh();
    });
  }

  const kept = entry?.photos.filter((p) => !removed.includes(p.id)) ?? [];

  return (
    <form onSubmit={onSubmit} className="flex-1 px-5 pt-6 pb-12 lg:px-12 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span role="status" className={`text-[13px] ${error ? "text-terre" : "text-doux"}`}>
          {error ?? (pending && step ? step : visibility)}
        </span>
        <button type="submit" className={`${btn} h-10`} disabled={pending}>
          {pending ? "Enregistrement…" : entry ? "Enregistrer" : "Publier"}
        </button>
      </div>

      <article className="w-full max-w-[720px] mx-auto flex flex-col gap-[22px]">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="surtitre">{formatLongDate(date)} {date.slice(0, 4)}</span>
            <label className="text-xs text-doux hover:text-noir cursor-pointer">
              <span className="sr-only">Date de l'entrée</span>
              <input
                type="date"
                name="entryDate"
                value={date}
                max="9999-12-31"
                required
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="bg-transparent text-xs text-doux border-b border-dashed border-noir/20 focus:outline-none focus:border-noir"
              />
            </label>
          </div>
          <input
            name="title"
            defaultValue={entry?.title ?? ""}
            maxLength={120}
            placeholder="Un titre, si tu veux"
            aria-label="Titre de l'entrée"
            className="w-full bg-transparent border-0 pt-1.5 font-serif text-[36px] lg:text-[44px] font-medium leading-[1.1] focus:outline-none placeholder:text-noir/30"
          />
        </div>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="float-left mr-1.5 text-[13px] text-doux">Humeur</legend>
          {MOODS.map((m) => {
            const on = mood === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => setMood(on ? null : m)}
                className={`inline-flex items-center gap-2 h-[34px] px-3 rounded-full border text-[13px] transition-colors ${
                  on ? "bg-noir border-noir text-casse font-medium" : "border-noir/12 hover:border-noir/30"
                }`}
              >
                <i className="w-2.5 h-2.5 rounded-full" style={{ background: MOOD_META[m].color }} />
                {MOOD_META[m].label}
              </button>
            );
          })}
        </fieldset>

        <textarea
          name="contentText"
          defaultValue={entry?.contentText}
          required
          maxLength={50000}
          aria-label="Ton entrée"
          placeholder="Qu'est-ce qui a compté aujourd'hui ?"
          className="w-full min-h-[40vh] [field-sizing:content] resize-none bg-transparent border-0 p-0 font-serif text-xl leading-[1.65] text-[#1E1C1A] focus:outline-none placeholder:italic placeholder:text-[#6F6A63]"
        />

        {(kept.length > 0 || previews.length > 0 || removed.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {kept.map((p, i) => (
              <figure key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-48 rounded-[10px] object-cover bg-ivoire" />
                <button
                  type="button"
                  onClick={() => setRemoved((r) => [...r, p.id])}
                  className="absolute top-2 right-2 h-8 px-3 rounded-full bg-noir/70 text-casse text-xs"
                >
                  Retirer
                </button>
              </figure>
            ))}
            {previews.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local avant envoi
              <img key={u} src={u} alt={`Nouvelle photo ${i + 1}`} className="w-full h-48 rounded-[10px] object-cover bg-ivoire" />
            ))}
            {removed.length > 0 && (
              <p className="col-span-2 text-xs text-doux">
                {removed.length} photo{removed.length > 1 ? "s" : ""} retirée{removed.length > 1 ? "s" : ""} à l'enregistrement.{" "}
                <button type="button" onClick={() => setRemoved([])} className="underline underline-offset-4">
                  Annuler
                </button>
              </p>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 h-[52px] px-4 rounded-[10px] border border-dashed border-noir/20 text-[13px] text-doux hover:border-noir/40 hover:text-noir cursor-pointer focus-within:outline-2">
          <IconPhoto size={18} />
          <span>
            {previews.length ? `${previews.length} photo${previews.length > 1 ? "s" : ""} prête${previews.length > 1 ? "s" : ""} à envoyer` : "Ajouter des photos"}
            <span className="text-doux"> · {MAX_PHOTOS} maximum, 10 Mo chacune</span>
          </span>
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="sr-only"
            onChange={(e) => setPreviews(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)))}
          />
        </label>
      </article>
    </form>
  );
}
