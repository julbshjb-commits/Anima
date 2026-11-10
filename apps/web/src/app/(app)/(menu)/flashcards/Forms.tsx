"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { CARD_KINDS, COVERS, clozeNumbers, formatDeckCode, type CardKind } from "@anima/core";
import type { Deck } from "@/lib/database.types";
import { IconPlus } from "@/components/icons";
import { btn, btnGhost } from "@/components/ui";
import { addCard, createDeck, deleteDeck, saveSettings, shareDeck, updateCard, updateDeck, type FlashState } from "./actions";

export const field =
  "h-11 px-3.5 rounded-xl bg-papier border border-trait text-sm text-texte placeholder:text-doux focus:outline-none focus:border-texte/40 focus:shadow-[0_0_0_4px_rgba(224,184,120,.15)] min-w-0";
const area = `${field} h-auto py-3 leading-relaxed resize-y`;

function FormError({ state }: { state: FlashState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-terre">
      {state.error}
    </p>
  ) : null;
}

/** Champs d'un paquet : nom, matière (qui sert de dossier), couverture, liens. */
function DeckFields({
  deck,
  subjects,
  notebooks = [],
  projects = [],
}: {
  deck?: Deck;
  subjects: string[];
  notebooks?: { id: string; title: string }[];
  projects?: { id: string; title: string }[];
}) {
  const [cover, setCover] = useState(deck?.cover ?? "lumiere-miel");
  return (
    <>
      <input name="title" required maxLength={120} defaultValue={deck?.title} placeholder="Révolution française" aria-label="Nom du paquet" className={field} />
      <input name="subject" maxLength={80} defaultValue={deck?.subject ?? ""} placeholder="Matière ou dossier : Histoire" aria-label="Matière" list="matieres" className={field} />
      <datalist id="matieres">
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <label className="flex flex-col gap-1 text-xs text-doux">
        Date de l'examen (facultatif, pour le compte à rebours)
        <input type="date" name="exam_date" defaultValue={deck?.exam_date ?? ""} className={field} />
      </label>
      {deck && <textarea name="description" maxLength={500} rows={2} defaultValue={deck.description ?? ""} placeholder="À quoi sert ce paquet ? (facultatif)" className={area} />}
      <input type="hidden" name="cover" value={cover} />
      <div className="flex gap-1.5" role="radiogroup" aria-label="Couleur">
        {COVERS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={cover === c.id}
            aria-label={c.label}
            onClick={() => setCover(c.id)}
            className={`w-7 h-7 rounded-full border transition-transform ${cover === c.id ? "ring-2 ring-champagne ring-offset-2 ring-offset-casse scale-110" : "border-trait hover:scale-105"}`}
            style={{ background: c.bg }}
          />
        ))}
      </div>
      {deck && (
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-doux">
            Relié au carnet
            <select name="notebook_id" defaultValue={deck.notebook_id ?? ""} className={field}>
              <option value="">Aucun</option>
              {notebooks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-doux">
            Relié au projet
            <select name="project_id" defaultValue={deck.project_id ?? ""} className={field}>
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </>
  );
}

export function NewDeck({ subjects, open: initial = false }: { subjects: string[]; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  const [state, action, pending] = useActionState(createDeck, {});
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        <IconPlus size={16} />
        Nouveau paquet
      </button>
    );
  return (
    <form action={action} className="rounded-2xl bg-papier border border-trait p-5 flex flex-col gap-3 w-full">
      <p className="surtitre">Nouveau paquet</p>
      <DeckFields subjects={subjects} />
      <FormError state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Création…" : "Créer le paquet"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function EditDeck(props: { deck: Deck; subjects: string[]; notebooks: { id: string; title: string }[]; projects: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(updateDeck, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={props.deck.id} />
      <DeckFields {...props} />
      <FormError state={state} />
      {state.ok && <p className="text-xs text-sauge">Enregistré.</p>}
      <button type="submit" disabled={pending} className={`${btn} self-start`}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

/** Entoure la sélection d'un trou {{cN::…}} (le numéro suit les trous existants). */
function makeHole(el: HTMLTextAreaElement | null, sameNumber: boolean) {
  if (!el) return;
  const { selectionStart: a, selectionEnd: b, value } = el;
  const nums = clozeNumbers(value);
  const n = sameNumber && nums.length ? Math.max(...nums) : (nums.length ? Math.max(...nums) : 0) + 1;
  const picked = value.slice(a, b) || "réponse";
  const next = `${value.slice(0, a)}{{c${n}::${picked}}}${value.slice(b)}`;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  const pos = a + `{{c${n}::`.length;
  el.setSelectionRange(pos, pos + picked.length);
}

export function CardFields({ kind, setKind, card }: { kind: CardKind; setKind: (k: CardKind) => void; card?: { front: string; back: string; tags: string[] } }) {
  const front = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Type de carte">
        {(Object.keys(CARD_KINDS) as CardKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`h-8 px-3 rounded-full text-[13px] border transition-colors ${kind === k ? "bg-noir text-casse border-noir font-medium" : "border-trait text-encre hover:bg-lin"}`}
          >
            {CARD_KINDS[k].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-doux">{CARD_KINDS[kind].hint}</p>
      <label className="flex flex-col gap-1.5 text-xs text-doux">
        {kind === "trous" ? "Texte avec ses trous" : kind === "inversee" ? "Recto (terme)" : "Question"}
        <textarea
          ref={front}
          name="front"
          required
          maxLength={2000}
          rows={kind === "trous" ? 3 : 2}
          defaultValue={card?.front}
          placeholder={kind === "trous" ? "La prise de la Bastille a lieu le {{c1::14 juillet 1789}}." : kind === "inversee" ? "Liberté" : "En quelle année tombe la Bastille ?"}
          className={`${area} text-[15px] text-texte`}
        />
      </label>
      {kind === "trous" && (
        <div className="flex flex-wrap gap-2 -mt-1">
          <button type="button" onClick={() => makeHole(front.current, false)} className="h-8 px-3 rounded-full border border-champagne/40 text-[13px] text-champagne hover:bg-champagne/10">
            Faire un trou avec la sélection
          </button>
          <button type="button" onClick={() => makeHole(front.current, true)} className="h-8 px-3 rounded-full border border-trait text-[13px] text-encre hover:bg-lin">
            Même trou (révisés ensemble)
          </button>
        </div>
      )}
      <label className="flex flex-col gap-1.5 text-xs text-doux">
        {kind === "trous" ? "Contexte au verso (facultatif)" : kind === "inversee" ? "Verso (définition, traduction)" : "Réponse"}
        <textarea name="back" required={kind !== "trous"} maxLength={4000} rows={2} defaultValue={card?.back} placeholder={kind === "inversee" ? "Freedom" : kind === "trous" ? "" : "1789"} className={`${area} text-[15px] text-texte`} />
      </label>
      <input name="tags" defaultValue={card?.tags.join(", ")} placeholder="Mots-clés, séparés par des virgules (facultatif)" aria-label="Mots-clés" className={field} />
    </>
  );
}

export function AddCard({ deckId, noteId }: { deckId: string; noteId?: string | null }) {
  const [kind, setKind] = useState<CardKind>("basique");
  const [state, action, pending] = useActionState(addCard, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      ref.current?.querySelector<HTMLTextAreaElement>("textarea[name=front]")?.focus();
    }
  }, [state.ok]);
  return (
    <form
      ref={ref}
      action={action}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ref.current?.requestSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="deckId" value={deckId} />
      {noteId && <input type="hidden" name="noteId" value={noteId} />}
      <CardFields kind={kind} setKind={setKind} />
      <FormError state={state} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Ajout…" : "Ajouter la carte"}
        </button>
        <span className="hidden lg:inline text-xs text-doux">ou ⌘ Entrée</span>
        {state.ok && <span className="text-xs text-sauge">Carte ajoutée.</span>}
      </div>
    </form>
  );
}

export function EditCard({
  card,
  approve,
  onDone,
}: {
  card: { id: string; deck_id: string; kind: CardKind; front: string; back: string; tags: string[] };
  approve?: boolean;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<CardKind>(card.kind);
  const [state, action, pending] = useActionState(updateCard, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="deckId" value={card.deck_id} />
      {approve && <input type="hidden" name="approve" value="1" />}
      <CardFields kind={kind} setKind={setKind} card={card} />
      <FormError state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {approve ? "Corriger et garder" : "Enregistrer"}
        </button>
        <button type="button" onClick={onDone} className={btnGhost}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function SettingsForm({ settings }: { settings: { new_per_day: number; reviews_per_day: number; daily_goal: number } }) {
  const [state, action, pending] = useActionState(saveSettings, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-doux">
          Nouvelles / jour
          <input name="new_per_day" type="number" min={0} max={999} defaultValue={settings.new_per_day} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-doux">
          Révisions max.
          <input name="reviews_per_day" type="number" min={1} max={9999} defaultValue={settings.reviews_per_day} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-doux">
          Objectif / jour
          <input name="daily_goal" type="number" min={1} max={9999} defaultValue={settings.daily_goal} className={field} />
        </label>
      </div>
      <FormError state={state} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnGhost}>
          Enregistrer
        </button>
        {state.ok && <span className="text-xs text-sauge">Enregistré.</span>}
      </div>
    </form>
  );
}

export function DeleteDeck({ id, count }: { id: string; count: number }) {
  return (
    <form
      action={deleteDeck}
      onSubmit={(e) => {
        if (!confirm(`Supprimer ce paquet et ses ${count} carte${count > 1 ? "s" : ""} ? Les progrès seront perdus.`)) e.preventDefault();
      }}
      className="border-t border-trait pt-4"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-terre hover:underline">
        Supprimer le paquet et toutes ses cartes
      </button>
    </form>
  );
}

/** Partage par code : chacun ajoute sa copie, les progrès restent privés. */
export function ShareDeck({ id, code }: { id: string; code: string | null }) {
  const [copied, setCopied] = useState<"code" | "lien" | null>(null);
  async function copy(what: "code" | "lien") {
    if (!code) return;
    const text = what === "code" ? formatDeckCode(code) : `${location.origin}/flashcards/ajouter?code=${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }
  if (!code)
    return (
      <form action={shareDeck} className="flex flex-col gap-3">
        <p className="text-sm text-doux leading-relaxed max-w-xl">
          Donne un code à ta promo : chacun ajoute sa propre copie et révise à son rythme. Personne ne voit tes réponses ni tes progrès.
        </p>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="on" value="1" />
        <button type="submit" className={`${btnGhost} self-start`}>
          Créer un code de partage
        </button>
      </form>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="titre chiffre-or text-[40px] leading-none tracking-[0.12em]" aria-label={`Code : ${code.split("").join(" ")}`}>
          {formatDeckCode(code)}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy("code")} className={btnGhost}>
            {copied === "code" ? "Code copié" : "Copier le code"}
          </button>
          <button type="button" onClick={() => copy("lien")} className={btnGhost}>
            {copied === "lien" ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
      </div>
      <p className="text-xs text-doux leading-relaxed max-w-xl">
        Tes camarades tapent ce code dans Flashcards, avec « Ajouter avec un code », ou ouvrent le lien. Les cartes que tu ajoutes ensuite leur sont proposées. Tes réponses et tes progrès restent privés.
      </p>
      <form
        action={shareDeck}
        onSubmit={(e) => {
          if (!confirm("Le code ne marchera plus. Ceux qui ont déjà ajouté le paquet gardent leur copie.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="on" value="0" />
        <button type="submit" className="text-sm text-terre hover:underline">
          Arrêter le partage
        </button>
      </form>
    </div>
  );
}
