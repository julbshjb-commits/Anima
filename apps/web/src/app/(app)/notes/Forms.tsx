"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { COVERS, formatInviteCode } from "@anima/core";
import { IconPlus } from "@/components/icons";
import { AttachFile } from "@/components/AttachFile";
import {
  addBlock,
  addSeance,
  copySeance,
  createNotebook,
  createNotebookInvite,
  noteToTask,
  saveNote,
  updateBlock,
  type NotesState,
} from "./actions";

const field =
  "h-10 px-3 rounded-lg bg-papier border border-noir/10 text-sm focus:outline-none focus:border-noir";
const primary =
  "h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50";
const ghost = "h-10 px-4 rounded-full text-sm text-doux hover:text-noir";

function useResetOnOk(state: NotesState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);
  return ref;
}

function FormError({ state }: { state: NotesState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-terre">
      {state.error}
    </p>
  ) : null;
}

function Disclosure({
  label,
  dark,
  children,
}: {
  label: string;
  dark?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          dark
            ? "w-full flex items-center justify-center gap-2 h-11 rounded-full bg-noir text-casse text-sm font-medium"
            : "w-full flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-noir/20 text-[13px] text-doux hover:text-noir hover:border-noir/40"
        }
      >
        <IconPlus size={dark ? 16 : 14} />
        {label}
      </button>
    );
  return (
    <div className="rounded-xl bg-papier border border-noir/10 p-4">
      {children(() => setOpen(false))}
    </div>
  );
}

/** Nouveau carnet : perso (fermé) ou de cours (partageable par code). */
export function NewNotebook({
  dark,
  defaultKind = "perso",
}: {
  dark?: boolean;
  defaultKind?: "perso" | "cours";
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    createNotebook,
    {},
  );
  const [kind, setKind] = useState(defaultKind);
  return (
    <Disclosure
      label={
        dark
          ? "Nouveau carnet"
          : defaultKind === "cours"
            ? "Carnet de cours partagé"
            : "Nouveau carnet"
      }
      dark={dark}
    >
      {(close) => (
        <form action={action} className="flex flex-col gap-3">
          <input
            name="title"
            required
            maxLength={80}
            placeholder={
              kind === "cours"
                ? "Droit constitutionnel"
                : "Économie, Croquis, Idées…"
            }
            aria-label="Nom du carnet"
            className={field}
            autoFocus
          />
          <fieldset className="grid grid-cols-2 gap-1 p-1 rounded-full bg-lin text-[13px]">
            <legend className="sr-only">Type de carnet</legend>
            {(["perso", "cours"] as const).map((k) => (
              <label
                key={k}
                className={`h-8 grid place-items-center rounded-full cursor-pointer ${kind === k ? "bg-noir text-casse font-medium" : "text-encre"}`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="sr-only"
                />
                {k === "perso" ? "Perso" : "Cours partagé"}
              </label>
            ))}
          </fieldset>
          {kind === "cours" && (
            <input
              name="subtitle"
              maxLength={80}
              placeholder="L2 · amphi B (facultatif)"
              aria-label="Précision"
              className={field}
            />
          )}
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Couleur</legend>
            {COVERS.map((c, i) => (
              <label key={c.id} title={c.label} className="cursor-pointer">
                <input
                  type="radio"
                  name="cover"
                  value={c.id}
                  defaultChecked={i === 2}
                  className="peer sr-only"
                />
                <span
                  className="block w-6 h-8 rounded-[3px] peer-checked:ring-2 peer-checked:ring-noir peer-checked:ring-offset-2 peer-checked:ring-offset-papier peer-focus-visible:ring-2"
                  style={{ background: c.bg }}
                />
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-doux leading-normal">
            {kind === "perso"
              ? "Visible par toi seul. Un carnet perso ne se partage jamais."
              : "Tu inviteras ta promo avec un code. Chacun écrit ses passages, signés de son initiale."}
          </p>
          <FormError state={state} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primary}>
              Créer
            </button>
            <button type="button" onClick={close} className={ghost}>
              Fermer
            </button>
          </div>
        </form>
      )}
    </Disclosure>
  );
}

/** Éditeur d'une note : titre, tags, texte. Enregistre aussi avec Ctrl/Cmd + S. */
export function NoteEditor({
  id,
  title,
  body,
  tags,
  readOnly,
}: {
  id: string;
  title: string;
  body: string;
  tags: string[];
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    saveNote,
    {},
  );
  const [dirty, setDirty] = useState(false);
  const [seen, setSeen] = useState(state.ok);
  if (state.ok !== seen) {
    // Enregistrement réussi : plus rien en attente.
    setSeen(state.ok);
    setDirty(false);
  }
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        ref.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form
      ref={ref}
      action={action}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          role="status"
          className={`text-[13px] ${state.error ? "text-terre" : "text-doux"}`}
        >
          {state.error ??
            (pending
              ? "Enregistrement…"
              : dirty
                ? "Modifications non enregistrées"
                : state.ok
                  ? "Enregistré"
                  : readOnly
                    ? "Lecture seule"
                    : "")}
        </span>
        {!readOnly && (
          <button type="submit" disabled={pending} className={primary}>
            Enregistrer
          </button>
        )}
      </div>
      <input
        name="title"
        defaultValue={title}
        required
        maxLength={120}
        readOnly={readOnly}
        aria-label="Titre de la note"
        className="w-full bg-transparent border-0 font-serif text-[36px] lg:text-[44px] font-medium leading-[1.1] focus:outline-none"
      />
      <label className="flex items-center gap-2 text-[13px] text-doux">
        <span className="shrink-0">Tags</span>
        <input
          name="tags"
          defaultValue={tags.map((t) => `#${t}`).join(" ")}
          readOnly={readOnly}
          maxLength={600}
          placeholder="#partiels #schéma"
          className="flex-1 min-w-0 bg-transparent border-b border-dashed border-noir/20 py-1 text-noir focus:outline-none focus:border-noir"
        />
      </label>
      <textarea
        name="body"
        defaultValue={body}
        readOnly={readOnly}
        maxLength={100000}
        aria-label="Texte de la note"
        placeholder="Écris, colle tes notes de cours, fais des listes…"
        className="w-full min-h-[50vh] [field-sizing:content] resize-none rounded-xl bg-papier border border-noir/8 p-6 lg:p-8 text-[17px] leading-[1.7] text-encre bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:24px_24px] focus:outline-none placeholder:italic placeholder:text-doux"
      />
    </form>
  );
}

/** « Transformer en tâche » : saisie rapide, la date est comprise (« revoir le graphique vendredi 18 h »). */
export function TaskFromNote({
  noteId,
  path,
}: {
  noteId: string;
  path: string;
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    noteToTask,
    {},
  );
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="path" value={path} />
      <div className="flex gap-2">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Revoir ce chapitre vendredi 18 h"
          aria-label="Nouvelle tâche née de cette page"
          className={`${field} flex-1 min-w-0`}
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Transformer en tâche"
          className="w-10 h-10 shrink-0 grid place-items-center rounded-lg bg-noir text-casse disabled:opacity-50"
        >
          <IconPlus size={16} />
        </button>
      </div>
      <FormError state={state} />
      {state.ok && !state.error && (
        <p className="text-xs text-doux">Ajoutée à M'organiser.</p>
      )}
    </form>
  );
}

export function NewSeance({
  notebookId,
  today,
}: {
  notebookId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    addSeance,
    {},
  );
  return (
    <Disclosure label="Nouvelle séance">
      {(close) => (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="notebookId" value={notebookId} />
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Le contrôle de constitutionnalité"
            aria-label="Titre de la séance"
            className={field}
            autoFocus
          />
          <input
            type="date"
            name="sessionDate"
            defaultValue={today}
            required
            aria-label="Date de la séance"
            className={field}
          />
          <FormError state={state} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primary}>
              Ouvrir la séance
            </button>
            <button type="button" onClick={close} className={ghost}>
              Fermer
            </button>
          </div>
        </form>
      )}
    </Disclosure>
  );
}

/** Zone d'écriture en bas de la séance : un passage ou une question pour le prof. */
export function AddBlock({
  userId,
  noteId,
  notebookId,
}: {
  userId: string;
  noteId: string;
  notebookId: string;
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    addBlock,
    {},
  );
  const [kind, setKind] = useState<"texte" | "question">("texte");
  const ref = useResetOnOk(state);
  return (
    <form
      ref={ref}
      action={action}
      className="flex flex-col gap-2 pl-0 lg:pl-9"
    >
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="notebookId" value={notebookId} />
      <input type="hidden" name="kind" value={kind} />
      <textarea
        name="content"
        required={kind === "question"}
        maxLength={20000}
        rows={3}
        aria-label={kind === "question" ? "Question pour le prof" : "Ton ajout"}
        placeholder={
          kind === "question"
            ? "Ta question pour le prof…"
            : "Écris ici, tes ajouts apparaîtront avec ton initiale…"
        }
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
            e.currentTarget.form?.requestSubmit();
        }}
        className="w-full [field-sizing:content] min-h-24 resize-none rounded-xl bg-papier border border-noir/10 p-4 text-[15px] leading-[1.6] focus:outline-none focus:border-noir placeholder:italic placeholder:text-doux"
      />
      {kind === "texte" && (
        <AttachFile
          key={state.ok ?? 0}
          userId={userId}
          label="Joindre une photo du tableau ou un fichier"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex p-1 rounded-full bg-lin text-[13px]"
          role="group"
          aria-label="Type d'ajout"
        >
          {(["texte", "question"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`h-8 px-3 rounded-full ${kind === k ? "bg-noir text-casse font-medium" : "text-encre"}`}
            >
              {k === "texte" ? "Passage" : "Question pour le prof"}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <FormError state={state} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "…" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

/** Modifier un de ses propres passages. */
export function EditBlock({
  id,
  notebookId,
  content,
}: {
  id: string;
  notebookId: string;
  content: string;
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    updateBlock,
    {},
  );
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(state.ok);
  if (state.ok !== seen) {
    setSeen(state.ok);
    setOpen(false);
  }
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-doux hover:text-noir"
      >
        Modifier
      </button>
    );
  return (
    <form action={action} className="basis-full flex flex-col gap-2 mt-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="notebookId" value={notebookId} />
      <textarea
        name="content"
        defaultValue={content}
        required
        maxLength={20000}
        aria-label="Modifier le passage"
        className="w-full [field-sizing:content] min-h-20 resize-none rounded-lg bg-papier border border-noir/15 p-3 text-[15px] leading-[1.6] focus:outline-none focus:border-noir"
        autoFocus
      />
      <FormError state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-8 px-3 rounded-full bg-noir text-casse text-xs font-medium"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-8 px-3 rounded-full text-xs text-doux hover:text-noir"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/** « Inviter » : génère un code montré une seule fois. */
export function InviteToNotebook({
  notebookId,
  title,
}: {
  notebookId: string;
  title: string;
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    createNotebookInvite,
    {},
  );
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <input type="hidden" name="notebookId" value={notebookId} />
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-4 rounded-full border border-noir/15 text-sm font-medium hover:bg-lin disabled:opacity-50"
        >
          {pending ? "…" : state.code ? "Autre code" : "Inviter"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-xs text-terre">
          {state.error}
        </p>
      )}
      {state.code && (
        <div className="w-[260px] rounded-xl bg-noir text-casse p-4 flex flex-col gap-2">
          <p className="text-[11px] tracking-[.12em] uppercase text-casse/60">
            Code pour ta promo
          </p>
          <p className="font-serif text-4xl tracking-[0.12em] select-all">
            {formatInviteCode(state.code)}
          </p>
          <p className="text-xs text-casse/70 leading-normal">
            Valable 48 h, jusqu'à 30 personnes. À entrer dans « Rejoindre ».
          </p>
          <button
            type="button"
            className="self-start h-8 px-3 rounded-full bg-blanc text-nuit text-xs font-medium"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `Rejoins le carnet de cours « ${title} » sur Anima avec le code ${formatInviteCode(state.code!)} (valable 48 h).`,
              );
              setCopied(true);
            }}
          >
            {copied ? "Message copié" : "Copier le message"}
          </button>
        </div>
      )}
    </div>
  );
}

export function CopySeance({
  noteId,
  notebooks,
}: {
  noteId: string;
  notebooks: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<NotesState, FormData>(
    copySeance,
    {},
  );
  if (!notebooks.length)
    return (
      <p className="text-xs text-doux leading-normal">
        Crée d'abord un carnet perso pour y copier tes séances.
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="noteId" value={noteId} />
      <select
        name="target"
        aria-label="Carnet perso"
        className={`${field} w-full`}
        defaultValue={notebooks[0]?.id}
      >
        {notebooks.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg border border-dashed border-noir/25 text-[13px] text-encre hover:border-noir/50 disabled:opacity-50"
      >
        {pending ? "Copie…" : "Copier dans mon carnet perso"}
      </button>
      <FormError state={state} />
    </form>
  );
}
