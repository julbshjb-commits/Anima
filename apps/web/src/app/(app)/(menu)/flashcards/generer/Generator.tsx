"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CARD_KINDS, cardFace, clozeNumbers, type CardKind, type DraftCard } from "@anima/core";
import { btn, btnGhost } from "@/components/ui";
import { uploadToDrive } from "@/lib/upload";
import { draftFromSource, saveDrafts } from "../actions";
import { field } from "../Forms";

type Draft = DraftCard & { key: number; keep: boolean };
let seq = 0;
const withKeys = (cards: DraftCard[]): Draft[] => cards.map((c) => ({ ...c, key: ++seq, keep: true }));

type Source = "texte" | "note" | "fichier";
const SOURCES: { id: Source; label: string }[] = [
  { id: "texte", label: "Coller un cours" },
  { id: "note", label: "Une note" },
  { id: "fichier", label: "Un PDF" },
];

export function Generator({
  userId,
  notes,
  files: initialFiles,
  decks,
  initialNote,
  initialFile,
  initialDeck,
  initialSubject = null,
  initialExam = null,
  aiAvailable,
}: {
  userId: string;
  notes: { id: string; title: string }[];
  files: { id: string; name: string; mime_type: string }[];
  initialFile: string | null;
  decks: { id: string; title: string; subject: string | null }[];
  initialNote: { id: string; title: string; text: string } | null;
  initialDeck: string | null;
  /** Matière et date d'examen choisies au premier lancement, pour le nouveau paquet. */
  initialSubject?: string | null;
  initialExam?: string | null;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState<Source>(initialFile ? "fichier" : initialNote || notes.length ? "note" : "texte");
  const [noteId, setNoteId] = useState(initialNote?.id ?? notes[0]?.id ?? "");
  const [files, setFiles] = useState(initialFiles);
  const [fileId, setFileId] = useState(initialFile ?? initialFiles[0]?.id ?? "");
  const [pasted, setPasted] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const ready = from === "texte" ? pasted.trim().length > 0 : from === "note" ? !!noteId : !!fileId;
  const isPdf = from === "fichier" && files.find((f) => f.id === fileId)?.mime_type === "application/pdf";
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [via, setVia] = useState<"auto" | "ia" | "manuel">("auto");
  const [msg, setMsg] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string>(initialDeck ?? (initialSubject ? "" : (decks[0]?.id ?? "")));
  const [newDeck, setNewDeck] = useState(initialSubject ?? initialNote?.title ?? initialFiles.find((f) => f.id === initialFile)?.name.replace(/\.[a-z0-9]+$/i, "") ?? "");
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  const run = (mode: "auto" | "ia") =>
    start(async () => {
      setMsg(null);
      const r = await draftFromSource(from === "texte" ? { text: pasted, title: pastedTitle } : from === "note" ? { note: noteId } : { file: fileId }, mode);
      if (r.error) setMsg(r.error);
      if (r.cards?.length) {
        setDrafts(withKeys(r.cards));
        setVia(r.via ?? mode);
      }
    });

  const update = (key: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const kept = drafts.filter((d) => d.keep);
  const invalid = kept.filter((d) => !d.front.trim() || (d.kind === "trous" ? clozeNumbers(d.front).length === 0 : !d.back.trim()));

  const save = () =>
    startSave(async () => {
      setMsg(null);
      const r = await saveDrafts({
        deckId: deckId || null,
        newDeck: deckId ? null : newDeck || pastedTitle || null,
        subject: deckId ? null : initialSubject,
        examDate: deckId ? null : initialExam,
        noteId: from === "note" && noteId ? noteId : null,
        via,
        cards: kept.map(({ kind, front, back }) => ({ kind, front, back })),
      });
      if (r.error) setMsg(r.error);
      else if (r.deckId) router.push(`/flashcards/paquet?id=${r.deckId}`);
    });

  async function upload(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    setUploading(true);
    const r = await uploadToDrive(userId, file);
    setUploading(false);
    if (picker.current) picker.current.value = "";
    if ("error" in r) return setMsg(r.error);
    setFiles((f) => [{ id: r.id, name: file.name, mime_type: file.type || "application/pdf" }, ...f]);
    setFileId(r.id);
    if (!deckId && !newDeck) setNewDeck(file.name.replace(/\.[a-z0-9]+$/i, ""));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-papier border border-trait p-5 lg:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-1 text-[13px]" role="tablist" aria-label="Source">
          {SOURCES.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={from === f.id} onClick={() => setFrom(f.id)} className={`h-8 px-3.5 rounded-full ${from === f.id ? "bg-noir text-casse font-medium" : "text-doux hover:text-noir"}`}>
              {f.label}
            </button>
          ))}
        </div>
        {from === "texte" ? (
          <div className="flex flex-col gap-2">
            <input value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} maxLength={120} placeholder="Titre du cours (facultatif) : Cours 4, le cœur" aria-label="Titre du cours" className={field} />
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={9}
              maxLength={120_000}
              aria-label="Texte du cours"
              placeholder="Colle ici ton cours, tes notes ou un extrait de manuel."
              className={`${field} h-auto py-3 text-[15px] leading-relaxed resize-y`}
            />
            <p className="text-[11px] text-doux">{pasted.length ? `${pasted.length.toLocaleString("fr-FR")} caractères` : "Rien n'est enregistré : seules les cartes que tu gardes le seront."}</p>
          </div>
        ) : from === "note" ? (
          <select value={noteId} onChange={(e) => setNoteId(e.target.value)} aria-label="Note de départ" className={field}>
            {notes.length === 0 && <option value="">Aucune note pour l'instant</option>}
            {initialNote && !notes.some((n) => n.id === initialNote.id) && <option value={initialNote.id}>{initialNote.title}</option>}
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            {files.length > 0 && (
              <select value={fileId} onChange={(e) => setFileId(e.target.value)} aria-label="Document de départ" className={`${field} flex-1`}>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <input ref={picker} type="file" accept="application/pdf,.pdf,text/plain,.txt,.md" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} tabIndex={-1} aria-hidden />
            <button type="button" disabled={uploading} onClick={() => picker.current?.click()} className={`${btnGhost} shrink-0`}>
              {uploading ? "Envoi…" : files.length ? "Importer un autre PDF" : "Importer un PDF ou un fichier texte"}
            </button>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-trait p-4 flex flex-col gap-2.5">
            <p className="text-sm font-medium">Repérage automatique</p>
            <p className="text-xs text-doux leading-relaxed">
              Reprend les lignes déjà écrites comme des fiches : « Terme : définition », « Question ? Réponse », ou les trous {"{{c1::…}}"}. Sans IA, rien ne quitte Anima.
            </p>
            {isPdf && <p className="text-[11px] text-doux">Un PDF se lit avec l'IA.</p>}
            <button type="button" disabled={!ready || pending || isPdf} onClick={() => run("auto")} className={`${btnGhost} self-start`}>
              {pending ? "Lecture…" : "Repérer les cartes"}
            </button>
          </div>
          <div className="rounded-xl border border-champagne/25 bg-champagne/[.03] p-4 flex flex-col gap-2.5">
            <p className="text-sm font-medium">Avec l'IA</p>
            <p className="text-xs text-doux leading-relaxed">
              Claude lit le texte et propose une idée par carte, courte et fidèle au texte, sans rien inventer. Le contenu n'est envoyé à Claude que quand tu appuies.
            </p>
            <button type="button" disabled={!ready || pending || !aiAvailable} onClick={() => run("ia")} className={`${btn} self-start`}>
              {pending ? "L'IA lit ton cours…" : "Proposer des cartes"}
            </button>
            {!aiAvailable && <p className="text-[11px] text-doux">Pas encore activé sur Anima. En attendant, ton assistant Claude relié à Anima peut proposer des cartes, que tu relis dans le paquet.</p>}
          </div>
        </div>
        {msg && (
          <p role="alert" className="text-sm text-terre">
            {msg}
          </p>
        )}
      </section>

      {drafts.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="titre text-[28px] leading-tight">Relis avant de garder</h2>
              <p className="text-xs text-doux">
                {kept.length} carte{kept.length > 1 ? "s" : ""} gardée{kept.length > 1 ? "s" : ""} sur {drafts.length}. Décoche ce qui ne sert pas, corrige ce qui est imprécis.
              </p>
            </div>
            <button type="button" onClick={() => setDrafts((d) => [...d, ...withKeys([{ kind: "basique", front: "", back: "" }])])} className={btnGhost}>
              Ajouter une carte
            </button>
          </div>
          <ul className="flex flex-col gap-2.5">
            {drafts.map((d) => (
              <li key={d.key} className={`rounded-xl bg-papier border px-4 py-3.5 flex flex-col gap-2.5 transition-opacity ${d.keep ? "border-trait" : "border-transparent opacity-45"}`}>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-doux">
                    <input type="checkbox" checked={d.keep} onChange={(e) => update(d.key, { keep: e.target.checked })} className="accent-[#e6c891] w-4 h-4" />
                    Garder
                  </label>
                  <select value={d.kind} onChange={(e) => update(d.key, { kind: e.target.value as CardKind })} aria-label="Type" className="ml-auto h-8 px-2 rounded-lg bg-transparent border border-trait text-xs">
                    {(Object.keys(CARD_KINDS) as CardKind[]).map((k) => (
                      <option key={k} value={k}>
                        {CARD_KINDS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  <textarea value={d.front} onChange={(e) => update(d.key, { front: e.target.value })} rows={2} maxLength={2000} aria-label="Question" placeholder="Question" className={`${field} h-auto py-2.5 text-[15px] leading-snug`} />
                  <textarea value={d.back} onChange={(e) => update(d.key, { back: e.target.value })} rows={2} maxLength={4000} aria-label="Réponse" placeholder={d.kind === "trous" ? "Contexte (facultatif)" : "Réponse"} className={`${field} h-auto py-2.5 text-[15px] leading-snug`} />
                </div>
                {d.kind === "trous" && clozeNumbers(d.front).length > 0 && <p className="text-xs text-doux">Aperçu : {cardFace(d, clozeNumbers(d.front)[0]!, "question")}</p>}
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-papier border border-trait p-5 flex flex-col gap-3 sticky bottom-24 lg:bottom-4">
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={deckId} onChange={(e) => setDeckId(e.target.value)} aria-label="Paquet" className={field}>
                {decks.map((dk) => (
                  <option key={dk.id} value={dk.id}>
                    {dk.subject ? `${dk.subject} · ` : ""}
                    {dk.title}
                  </option>
                ))}
                <option value="">+ Nouveau paquet…</option>
              </select>
              {!deckId && <input value={newDeck} onChange={(e) => setNewDeck(e.target.value)} maxLength={120} placeholder="Nom du nouveau paquet" aria-label="Nom du nouveau paquet" className={field} />}
            </div>
            {invalid.length > 0 && <p className="text-xs text-terre">{invalid.length} carte{invalid.length > 1 ? "s" : ""} à compléter (réponse manquante, ou texte à trous sans trou).</p>}
            <button type="button" disabled={saving || kept.length === 0 || invalid.length > 0} onClick={save} className={`${btn} self-start`}>
              {saving ? "Enregistrement…" : `Garder ${kept.length} carte${kept.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
