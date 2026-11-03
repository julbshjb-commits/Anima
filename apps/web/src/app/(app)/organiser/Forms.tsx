"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { MOODS, MOOD_META } from "@anima/core";
import { IconPlus } from "@/components/icons";
import { addEvent, addProject, addRitual, addTask, type OrgState } from "./actions";

/** Vide le formulaire après un ajout réussi. */
function useResetOnOk(state: OrgState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);
  return ref;
}

const field = "h-10 px-3 rounded-lg bg-papier border border-noir/10 text-sm focus:outline-none focus:border-noir";

function FormError({ state }: { state: OrgState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-terre">
      {state.error}
    </p>
  ) : null;
}

/** « Ajouter… "appeler maman demain 18 h" » : la date et l'heure sont comprises. */
export function QuickAdd({ day, projects, projectId }: { day: string; projects: { id: string; title: string }[]; projectId?: string }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(addTask, {});
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} id="ajouter" className="flex flex-col gap-2 scroll-mt-6">
      <div className="flex items-center gap-2 h-[52px] pl-4 pr-1.5 rounded-full bg-papier border border-noir/10 focus-within:border-noir">
        <IconPlus size={18} className="text-doux shrink-0" />
        <input
          name="title"
          required
          maxLength={200}
          aria-label="Nouvelle tâche"
          placeholder="Ajouter… « appeler maman demain 18 h »"
          className="flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none placeholder:text-doux"
        />
        <input type="hidden" name="day" value={day} />
        {projectId ? (
          <input type="hidden" name="projectId" value={projectId} />
        ) : (
          projects.length > 0 && (
            <select name="projectId" aria-label="Projet" defaultValue="" className="hidden sm:block h-9 max-w-36 px-2 rounded-full bg-lin text-xs focus:outline-none">
              <option value="">Sans projet</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )
        )}
        <button type="submit" disabled={pending} className="h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50">
          {pending ? "…" : "Ajouter"}
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

function Swatches({ name }: { name: string }) {
  return (
    <fieldset className="flex flex-wrap gap-1.5">
      <legend className="sr-only">Couleur</legend>
      {MOODS.map((m, i) => (
        <label key={m} title={MOOD_META[m].label} className="cursor-pointer">
          <input type="radio" name={name} value={m} defaultChecked={i === 3} className="peer sr-only" />
          <span className="block w-6 h-6 rounded-full peer-checked:ring-2 peer-checked:ring-noir peer-checked:ring-offset-2 peer-checked:ring-offset-papier peer-focus-visible:ring-2" style={{ background: MOOD_META[m].color }} />
        </label>
      ))}
    </fieldset>
  );
}

/** Petit bouton « + » qui déplie un formulaire. */
function Disclosure({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-noir/20 text-[13px] text-doux hover:text-noir hover:border-noir/40"
      >
        <IconPlus size={14} />
        {label}
      </button>
    );
  return <div className="rounded-xl bg-papier border border-noir/10 p-4">{children(() => setOpen(false))}</div>;
}

export function NewEvent({ day }: { day: string }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(addEvent, {});
  const ref = useResetOnOk(state);
  return (
    <Disclosure label="Ajouter un rendez-vous">
      {(close) => (
        <form ref={ref} action={action} className="flex flex-col gap-3">
          <input name="title" required maxLength={120} placeholder="Cours d'économie, dîner…" aria-label="Titre" className={field} autoFocus />
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input type="date" name="day" defaultValue={day} required aria-label="Jour" className={field} />
            <input type="time" name="start" required defaultValue="09:00" aria-label="Début" className={field} />
            <input type="time" name="end" aria-label="Fin" className={field} />
          </div>
          <input name="place" maxLength={120} placeholder="Lieu (facultatif)" aria-label="Lieu" className={field} />
          <Swatches name="color" />
          <FormError state={state} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50">
              Ajouter
            </button>
            <button type="button" onClick={close} className="h-10 px-4 rounded-full text-sm text-doux hover:text-noir">
              Fermer
            </button>
          </div>
        </form>
      )}
    </Disclosure>
  );
}

export function NewProject() {
  const [state, action, pending] = useActionState<OrgState, FormData>(addProject, {});
  const ref = useResetOnOk(state);
  return (
    <Disclosure label="Nouveau projet">
      {(close) => (
        <form ref={ref} action={action} className="flex flex-col gap-3">
          <input name="title" required maxLength={80} placeholder="Partiels de décembre…" aria-label="Nom du projet" className={field} autoFocus />
          <Swatches name="color" />
          <FormError state={state} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="h-9 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50">
              Créer
            </button>
            <button type="button" onClick={close} className="h-9 px-3 rounded-full text-sm text-doux hover:text-noir">
              Fermer
            </button>
          </div>
        </form>
      )}
    </Disclosure>
  );
}

export function NewRitual() {
  const [state, action, pending] = useActionState<OrgState, FormData>(addRitual, {});
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input name="title" required maxLength={80} placeholder="Nouveau rituel : lire 20 minutes…" aria-label="Nouveau rituel" className={`${field} flex-1 min-w-0`} />
        <button type="submit" disabled={pending} aria-label="Ajouter le rituel" className="w-10 h-10 shrink-0 grid place-items-center rounded-lg bg-noir text-casse disabled:opacity-50">
          <IconPlus size={16} />
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}
