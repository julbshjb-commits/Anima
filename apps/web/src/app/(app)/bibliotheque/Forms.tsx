"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { COVERS, WORK_KINDS, WORK_STATUS, type Work } from "@anima/core";
import { IconPlus } from "@/components/icons";
import {
  addQuote,
  addWork,
  setGoal,
  setProgress,
  updateWork,
  type BiblioState,
} from "./actions";

const field =
  "h-10 px-3 rounded-lg bg-papier border border-noir/10 text-sm focus:outline-none focus:border-noir min-w-0";
const primary =
  "h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50";

function useResetOnOk(state: BiblioState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);
  return ref;
}

function FormError({ state }: { state: BiblioState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-terre">
      {state.error}
    </p>
  ) : null;
}

/** Champs communs à l'ajout et à la modification d'une œuvre. */
function WorkFields({ work }: { work?: Work }) {
  const [kind, setKind] = useState<Work["kind"]>(work?.kind ?? "livre");
  const [status, setStatus] = useState<Work["status"]>(
    work?.status ?? "en-cours",
  );
  const unit = WORK_KINDS[kind].unit;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Work["kind"])}
          aria-label="Type"
          className={field}
        >
          {Object.entries(WORK_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Work["status"])}
          aria-label="Où j'en suis"
          className={field}
        >
          {Object.entries(WORK_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={work?.title}
          placeholder="Les Années"
          aria-label="Titre"
          className={`${field} sm:col-span-2`}
        />
        <input
          name="creator"
          maxLength={120}
          defaultValue={work?.creator ?? ""}
          placeholder={
            kind === "livre"
              ? "Autrice ou auteur"
              : kind === "film" || kind === "serie"
                ? "Réalisation"
                : "Auteur, émission…"
          }
          aria-label="Créateur"
          className={`${field} sm:col-span-2`}
        />
        {unit && (
          <>
            <label className="flex flex-col gap-1 text-xs text-doux">
              {unit[0].toUpperCase() + unit.slice(1)} où j'en suis
              <input
                name="progress"
                type="number"
                min={0}
                defaultValue={work?.progress ?? ""}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-doux">
              {unit[0].toUpperCase() + unit.slice(1)}s en tout
              <input
                name="progress_total"
                type="number"
                min={1}
                defaultValue={work?.progress_total ?? ""}
                className={field}
              />
            </label>
          </>
        )}
        {kind === "article" && (
          <input
            name="url"
            type="url"
            defaultValue={work?.url ?? ""}
            placeholder="https://…"
            aria-label="Lien"
            className={`${field} sm:col-span-2`}
          />
        )}
      </div>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Couleur de couverture</legend>
        {COVERS.map((c) => (
          <label key={c.id} title={c.label} className="cursor-pointer">
            <input
              type="radio"
              name="cover"
              value={c.id}
              defaultChecked={(work?.cover ?? "vintage-bordeaux") === c.id}
              className="peer sr-only"
            />
            <span
              className="block w-6 h-9 rounded-[3px] peer-checked:ring-2 peer-checked:ring-noir peer-checked:ring-offset-2 peer-checked:ring-offset-papier peer-focus-visible:ring-2"
              style={{ background: c.bg }}
            />
          </label>
        ))}
      </fieldset>
    </>
  );
}

export function AddWork() {
  const [state, action, pending] = useActionState<BiblioState, FormData>(
    addWork,
    {},
  );
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-noir text-casse text-sm font-medium"
      >
        <IconPlus size={16} />
        Ajouter une œuvre
      </button>
    );
  return (
    <form
      action={action}
      className="rounded-xl bg-papier border border-noir/10 p-4 flex flex-col gap-3"
    >
      <WorkFields />
      <FormError state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primary}>
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 px-3 text-sm text-doux hover:text-noir"
        >
          Fermer
        </button>
      </div>
    </form>
  );
}

export function EditWork({ work }: { work: Work }) {
  const [state, action, pending] = useActionState<BiblioState, FormData>(
    updateWork,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={work.id} />
      <WorkFields work={work} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-doux">
          Commencé le
          <input
            type="date"
            name="started_on"
            defaultValue={work.started_on ?? ""}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-doux">
          Terminé le
          <input
            type="date"
            name="finished_on"
            defaultValue={work.finished_on ?? ""}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-doux">
          Ma note
          <select
            name="rating"
            defaultValue={work.rating ?? ""}
            className={field}
          >
            <option value="">Pas de note</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        name="note"
        defaultValue={work.note ?? ""}
        maxLength={5000}
        rows={4}
        placeholder="Ce que j'en garde…"
        aria-label="Mes notes"
        className="w-full [field-sizing:content] min-h-24 resize-none rounded-lg bg-papier border border-noir/10 p-3 text-[15px] leading-[1.6] focus:outline-none focus:border-noir"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primary}>
          Enregistrer
        </button>
        <FormError state={state} />
        {state.ok && !state.error && (
          <span className="text-xs text-doux">Enregistré</span>
        )}
      </div>
    </form>
  );
}

/** « Noter où j'en suis » : un nombre, et l'œuvre passe en « Terminé » à la dernière page. */
export function ProgressForm({ work, dark }: { work: Work; dark?: boolean }) {
  const [state, action, pending] = useActionState<BiblioState, FormData>(
    setProgress,
    {},
  );
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(state.ok);
  if (state.ok !== seen) {
    setSeen(state.ok);
    setOpen(false);
  }
  const unit = WORK_KINDS[work.kind].unit || "page";
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          dark
            ? primary
            : "h-10 px-4 rounded-full border border-noir/15 text-sm hover:bg-lin"
        }
      >
        Noter où j'en suis
      </button>
    );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={work.id} />
      <label className="flex items-center gap-2 text-sm">
        <span>{unit[0].toUpperCase() + unit.slice(1)}</span>
        <input
          name="progress"
          type="number"
          min={0}
          max={work.progress_total ?? undefined}
          defaultValue={work.progress ?? ""}
          required
          autoFocus
          className={`${field} w-24`}
        />
        {work.progress_total && (
          <span className="text-doux">sur {work.progress_total}</span>
        )}
      </label>
      <button type="submit" disabled={pending} className={primary}>
        OK
      </button>
      <FormError state={state} />
    </form>
  );
}

export function QuoteForm({
  workId,
  compact,
}: {
  workId?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<BiblioState, FormData>(
    addQuote,
    {},
  );
  const [open, setOpen] = useState(!compact);
  const ref = useResetOnOk(state);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-4 rounded-full border border-noir/15 text-sm hover:bg-lin"
      >
        Garder une citation
      </button>
    );
  return (
    <form
      ref={ref}
      action={action}
      className={`flex flex-col gap-2 ${compact ? "basis-full max-w-xl" : ""}`}
    >
      {workId && <input type="hidden" name="workId" value={workId} />}
      <textarea
        name="text"
        required
        maxLength={2000}
        rows={2}
        placeholder="« Sauver quelque chose du temps où l'on ne sera plus jamais. »"
        aria-label="Citation"
        className="w-full [field-sizing:content] resize-none rounded-lg bg-papier border border-noir/10 p-3 font-serif italic text-lg focus:outline-none focus:border-noir"
        autoFocus={compact}
      />
      <div className="flex gap-2">
        <input
          name="source"
          maxLength={200}
          placeholder="p. 254"
          aria-label="Source"
          className={`${field} flex-1`}
        />
        <button type="submit" disabled={pending} className={primary}>
          Garder
        </button>
      </div>
      <FormError state={state} />
      {state.ok && !state.error && (
        <p className="text-xs text-doux">Citation gardée.</p>
      )}
    </form>
  );
}

export function GoalForm({
  year,
  target,
}: {
  year: number;
  target: number | null;
}) {
  const [state, action, pending] = useActionState<BiblioState, FormData>(
    setGoal,
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
        className="text-xs text-doux underline underline-offset-4 hover:text-noir w-fit"
      >
        {target ? "Changer l'objectif" : `Me fixer un objectif pour ${year}`}
      </button>
    );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="year" value={year} />
      <input
        name="target"
        type="number"
        min={1}
        max={1000}
        defaultValue={target ?? 12}
        required
        autoFocus
        aria-label="Nombre de livres"
        className={`${field} w-20`}
      />
      <span className="text-xs text-doux">livres</span>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-3 rounded-full bg-noir text-casse text-xs font-medium"
      >
        OK
      </button>
      <FormError state={state} />
    </form>
  );
}
