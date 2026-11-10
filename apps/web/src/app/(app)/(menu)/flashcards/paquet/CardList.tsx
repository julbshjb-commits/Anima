"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CARD_KINDS, CARD_STATES, cardFace, formatDelay, type CardKind, type CardState } from "@anima/core";
import { approveCards, deleteCard, resetCard, toggleSuspend } from "../actions";
import { EditCard, field } from "../Forms";

export type ListCard = {
  id: string;
  deck_id: string;
  kind: CardKind;
  front: string;
  back: string;
  tags: string[];
  note_id: string | null;
  source: "manuel" | "ia" | "auto";
  status: "active" | "a-verifier";
  suspended: boolean;
  schedules: { variant: number; state: CardState; due_at: string; interval_days: number; lapses: number }[];
};

const small = "h-8 px-3 rounded-full text-xs border border-trait hover:bg-lin transition-colors";

export function CardList({ cards, notes, now }: { cards: ListCard[]; notes: Record<string, string>; now: number }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"toutes" | "difficiles" | "suspendues">("toutes");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (!s || `${c.front} ${c.back} ${c.tags.join(" ")}`.toLowerCase().includes(s)) &&
        (filtre === "toutes" || (filtre === "suspendues" ? c.suspended : c.schedules.some((x) => x.lapses >= 2))),
    );
  }, [cards, q, filtre]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une carte" aria-label="Chercher une carte" className={`${field} flex-1 min-w-[200px]`} />
        <div className="flex gap-1 text-[13px]">
          {(["toutes", "difficiles", "suspendues"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFiltre(f)} aria-pressed={filtre === f} className={`h-8 px-3 rounded-full ${filtre === f ? "bg-noir text-casse" : "text-doux hover:text-noir"}`}>
              {f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 && <p className="text-sm text-doux">Aucune carte ici.</p>}
      <ul className="flex flex-col gap-2">
        {list.map((c) => (
          <CardRow key={c.id} c={c} note={c.note_id ? notes[c.note_id] : undefined} now={now} />
        ))}
      </ul>
    </div>
  );
}

function CardRow({ c, note, now, toCheck }: { c: ListCard; note?: string; now: number; toCheck?: boolean }) {
  const [editing, setEditing] = useState(false);
  const done = useCallback(() => setEditing(false), []);
  const s = c.schedules[0];
  const next = s && s.state !== "nouvelle" ? Date.parse(s.due_at) - now : null;
  if (editing)
    return (
      <li className="rounded-2xl bg-papier border border-champagne/30 p-5">
        <EditCard card={c} approve={toCheck} onDone={done} />
      </li>
    );
  return (
    <li className={`rounded-xl bg-papier border border-trait px-5 py-4 flex flex-col gap-3 ${c.suspended ? "opacity-55" : ""}`}>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        <p className="text-[15px] leading-snug">{cardFace(c, c.kind === "trous" ? (s?.variant ?? 1) : 0, "question")}</p>
        <p className="text-[15px] leading-snug text-encre/80">{c.kind === "trous" ? cardFace(c, s?.variant ?? 1, "reponse") : c.back}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px] text-doux">
        <span className="px-2 h-6 grid place-items-center rounded-full border border-trait">{CARD_KINDS[c.kind].short}</span>
        {c.source === "ia" && <span className="px-2 h-6 grid place-items-center rounded-full border border-champagne/30 text-champagne">Proposée par l'IA</span>}
        {!toCheck && s && <span>{CARD_STATES[s.state]}{next != null ? (next <= 0 ? " · à revoir maintenant" : ` · revient dans ${formatDelay(next)}`) : ""}</span>}
        {c.tags.length > 0 && <span>#{c.tags.join(" #")}</span>}
        {note && c.note_id && (
          <Link href={`/notes/${c.note_id}`} className="underline underline-offset-2 hover:text-noir">
            Note : {note}
          </Link>
        )}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {toCheck && (
            <form action={approveCards}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="deckId" value={c.deck_id} />
              <button type="submit" className={`${small} !border-champagne/40 text-champagne`}>
                Garder
              </button>
            </form>
          )}
          <button type="button" onClick={() => setEditing(true)} className={small}>
            Modifier
          </button>
          {!toCheck && (
            <>
              <form action={toggleSuspend}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="deckId" value={c.deck_id} />
                <input type="hidden" name="suspended" value={c.suspended ? "0" : "1"} />
                <button type="submit" className={small} title="Une carte en pause ne revient plus en révision">
                  {c.suspended ? "Reprendre" : "Mettre en pause"}
                </button>
              </form>
              {s && s.state !== "nouvelle" && (
                <form action={resetCard}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="deckId" value={c.deck_id} />
                  <button type="submit" className={small}>
                    Réapprendre
                  </button>
                </form>
              )}
            </>
          )}
          <form
            action={deleteCard}
            onSubmit={(e) => {
              if (!toCheck && !confirm("Supprimer cette carte et ses progrès ?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="deckId" value={c.deck_id} />
            <button type="submit" className={`${small} hover:!text-terre`}>
              {toCheck ? "Retirer" : "Supprimer"}
            </button>
          </form>
        </span>
      </div>
    </li>
  );
}

/** Cartes proposées par un assistant : à relire avant qu'elles entrent en révision. */
export function ToCheck({ cards, notes, now }: { cards: ListCard[]; notes: Record<string, string>; now: number }) {
  return (
    <section className="rounded-2xl border border-champagne/30 bg-champagne/[.04] p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="titre text-[26px] leading-tight">À relire avant de garder</h2>
          <p className="text-xs text-doux">Proposées par ton assistant IA. Rien n'entre en révision sans ton accord.</p>
        </div>
        <form action={approveCards}>
          <input type="hidden" name="deckId" value={cards[0]?.deck_id} />
          <input type="hidden" name="all" value="1" />
          <button type="submit" className="h-9 px-4 rounded-full bg-[linear-gradient(180deg,#f0d8a8,#d4ad6c)] text-nuit text-[13px] font-semibold">
            Tout garder ({cards.length})
          </button>
        </form>
      </div>
      <ul className="flex flex-col gap-2">
        {cards.map((c) => (
          <CardRow key={c.id} c={c} note={c.note_id ? notes[c.note_id] : undefined} now={now} toCheck />
        ))}
      </ul>
    </section>
  );
}
