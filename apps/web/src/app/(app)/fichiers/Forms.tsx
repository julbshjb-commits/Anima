"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILE_ACCEPT } from "@anima/core";
import { uploadToDrive } from "@/lib/upload";
import { IconImporter } from "@/components/icons";
import {
  createFolder,
  deleteFolder,
  linkNote,
  moveFile,
  renameFile,
  shareToCircle,
  type FichierState,
} from "./actions";

const field =
  "h-10 px-3 rounded-lg bg-papier border border-noir/10 text-sm focus:outline-none focus:border-noir min-w-0";
const outline =
  "h-10 px-4 rounded-full border border-noir/15 text-sm font-medium hover:bg-lin disabled:opacity-50";

function FormError({ state }: { state: FichierState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-terre">
      {state.error}
    </p>
  ) : null;
}

/** « Importer » : plusieurs fichiers d'un coup, dans le dossier ouvert. */
export function Importer({
  userId,
  folderId,
}: {
  userId: string;
  folderId: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function send(files: File[]) {
    if (!files.length) return;
    setErrors([]);
    start(async () => {
      const failed: string[] = [];
      for (const [i, f] of files.entries()) {
        setStatus(
          files.length > 1
            ? `Envoi ${i + 1} sur ${files.length}…`
            : `Envoi de « ${f.name} »…`,
        );
        const res = await uploadToDrive(userId, f, folderId);
        if ("error" in res) failed.push(res.error);
      }
      setStatus(null);
      setErrors(failed);
      router.refresh();
    });
  }

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        send([...e.dataTransfer.files]);
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          send([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-60"
      >
        <IconImporter size={16} />
        {pending ? "Envoi…" : "Importer"}
      </button>
      <p role="status" className="text-xs text-doux empty:hidden">
        {status}
      </p>
      {errors.map((e) => (
        <p key={e} role="alert" className="text-xs text-terre">
          {e}
        </p>
      ))}
    </div>
  );
}

export function NewFolder({ parentId }: { parentId: string | null }) {
  const [state, action, pending] = useActionState<FichierState, FormData>(
    createFolder,
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
      <button type="button" onClick={() => setOpen(true)} className={outline}>
        Nouveau dossier
      </button>
    );
  return (
    <form action={action} className="flex items-center gap-2">
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <input
        name="name"
        required
        maxLength={120}
        autoFocus
        placeholder="Nom du dossier"
        aria-label="Nom du dossier"
        className={`${field} w-44`}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50"
      >
        Créer
      </button>
      <FormError state={state} />
    </form>
  );
}

export function DeleteFolder({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FichierState, FormData>(
    deleteFolder,
    {},
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-[13px] text-doux underline underline-offset-4 hover:text-noir"
      >
        Supprimer ce dossier
      </button>
      <FormError state={state} />
    </form>
  );
}

/** Petit formulaire qui se déplie depuis un bouton du panneau. */
function Fold({
  label,
  quiet,
  children,
}: {
  label: string;
  /** Lien discret plutôt que grand bouton (actions secondaires). */
  quiet?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={quiet ? "text-[13px] text-encre hover:text-noir underline-offset-4 hover:underline" : outline}
      >
        {label}
      </button>
    );
  return (
    <div className="rounded-2xl border border-noir/12 p-3 flex flex-col gap-2">
      {children(() => setOpen(false))}
    </div>
  );
}

function useClosingAction(
  fn: (s: FichierState, f: FormData) => Promise<FichierState>,
  close: () => void,
) {
  const [state, action, pending] = useActionState<FichierState, FormData>(
    async (s, f) => {
      const r = await fn(s, f);
      if (r.ok) close();
      return r;
    },
    {},
  );
  return { state, action, pending };
}

function LinkNoteForm({
  id,
  noteId,
  notes,
  close,
}: {
  id: string;
  noteId: string | null;
  notes: { id: string; title: string }[];
  close: () => void;
}) {
  const { state, action, pending } = useClosingAction(linkNote, close);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="noteId"
        defaultValue={noteId ?? ""}
        aria-label="Note"
        className={field}
      >
        <option value="">Aucune note</option>
        {notes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={outline}>
          Lier
        </button>
        <button type="button" onClick={close} className="text-sm text-doux px-2">
          Fermer
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function LinkNote(props: {
  id: string;
  noteId: string | null;
  notes: { id: string; title: string }[];
}) {
  if (!props.notes.length)
    return (
      <p className="text-xs text-doux leading-normal">
        Écris une note dans Notes pour pouvoir y lier ce fichier.
      </p>
    );
  return (
    <Fold label={props.noteId ? "Changer la note liée" : "Lier à une note"}>
      {(close) => <LinkNoteForm {...props} close={close} />}
    </Fold>
  );
}

function ShareForm({
  id,
  circles,
  close,
}: {
  id: string;
  circles: { id: string; name: string }[];
  close: () => void;
}) {
  const [state, action, pending] = useActionState<FichierState, FormData>(
    shareToCircle,
    {},
  );
  if (state.ok)
    return (
      <p role="status" className="text-sm">
        Partagé. Les membres du cercle peuvent l&apos;ouvrir.{" "}
        <button type="button" onClick={close} className="underline underline-offset-4">
          Fermer
        </button>
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="circleId" aria-label="Cercle" className={field}>
        {circles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <textarea
        name="body"
        rows={2}
        maxLength={5000}
        placeholder="Un mot pour accompagner (facultatif)"
        aria-label="Message"
        className="rounded-lg bg-papier border border-noir/10 p-3 text-sm resize-none focus:outline-none focus:border-noir"
      />
      <p className="text-xs text-doux leading-normal">
        Les membres pourront ouvrir le fichier tant qu&apos;il n&apos;est pas
        dans ta corbeille.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={outline}>
          Partager
        </button>
        <button type="button" onClick={close} className="text-sm text-doux px-2">
          Fermer
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function ShareToCircle(props: {
  id: string;
  circles: { id: string; name: string }[];
}) {
  if (!props.circles.length)
    return (
      <p className="text-xs text-doux leading-normal">
        Crée ou rejoins un cercle pour y partager ce fichier.
      </p>
    );
  return (
    <Fold label="Partager avec un cercle">
      {(close) => <ShareForm {...props} close={close} />}
    </Fold>
  );
}

function RenameForm({
  id,
  name,
  close,
}: {
  id: string;
  name: string;
  close: () => void;
}) {
  const { state, action, pending } = useClosingAction(renameFile, close);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="name"
        defaultValue={name}
        required
        maxLength={200}
        autoFocus
        aria-label="Nom du fichier"
        className={field}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={outline}>
          Renommer
        </button>
        <button type="button" onClick={close} className="text-sm text-doux px-2">
          Fermer
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function Rename(props: { id: string; name: string }) {
  return (
    <Fold label="Renommer" quiet>
      {(close) => <RenameForm {...props} close={close} />}
    </Fold>
  );
}

function MoveForm({
  id,
  folderId,
  folders,
  close,
}: {
  id: string;
  folderId: string | null;
  folders: { id: string; label: string }[];
  close: () => void;
}) {
  const { state, action, pending } = useClosingAction(moveFile, close);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="folderId"
        defaultValue={folderId ?? ""}
        aria-label="Dossier"
        className={field}
      >
        <option value="">Mon disque</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={outline}>
          Déplacer
        </button>
        <button type="button" onClick={close} className="text-sm text-doux px-2">
          Fermer
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function Move(props: {
  id: string;
  folderId: string | null;
  folders: { id: string; label: string }[];
}) {
  return (
    <Fold label="Déplacer" quiet>
      {(close) => <MoveForm {...props} close={close} />}
    </Fold>
  );
}
