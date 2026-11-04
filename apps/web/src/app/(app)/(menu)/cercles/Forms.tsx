"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MOODS, MOOD_META, formatInviteCode } from "@anima/core";
import { browserClient } from "@/lib/supabase/browser";
import { AttachFile } from "@/components/AttachFile";
import {
  comment,
  createCircle,
  createCircleInvite,
  markSeen,
  publish,
  saveQuoteFromPost,
  type CercleState,
} from "./actions";

const field =
  "h-10 px-3 rounded-lg bg-papier border border-noir/10 text-sm focus:outline-none focus:border-noir";
const primary =
  "h-10 px-4 rounded-full bg-noir text-casse text-sm font-medium disabled:opacity-50";

function useResetOnOk(state: CercleState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);
  return ref;
}

function FormError({ state }: { state: CercleState }) {
  return state.error ? (
    <p role="alert" className="text-xs text-terre">
      {state.error}
    </p>
  ) : null;
}

type Kind = "mot" | "evenement" | "citation";

/** « Partage quelque chose avec un cercle… » : un mot, un événement ou une citation. */
export function Composer({
  userId,
  circles,
  defaultCircle,
}: {
  userId: string;
  circles: { id: string; name: string }[];
  defaultCircle?: string;
}) {
  const [state, action, pending] = useActionState<CercleState, FormData>(
    publish,
    {},
  );
  const [kind, setKind] = useState<Kind>("mot");
  const ref = useResetOnOk(state);
  const kinds: { id: Kind; label: string }[] = [
    { id: "mot", label: "Un mot" },
    { id: "evenement", label: "Un événement" },
    { id: "citation", label: "Une citation" },
  ];
  return (
    <form
      ref={ref}
      action={action}
      className="rounded-2xl bg-papier border border-noir/8 p-5 flex flex-col gap-3"
    >
      <input type="hidden" name="kind" value={kind} />
      <textarea
        name="body"
        maxLength={5000}
        rows={2}
        aria-label="Ton message"
        placeholder={
          kind === "citation"
            ? "Pourquoi elle t'a fait penser à eux (facultatif)…"
            : kind === "evenement"
              ? "Un mot pour accompagner (facultatif)…"
              : "Partage quelque chose avec un cercle…"
        }
        className="w-full [field-sizing:content] min-h-12 resize-none bg-transparent text-[16px] leading-[1.55] focus:outline-none placeholder:text-doux"
      />
      {kind === "evenement" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            name="eventTitle"
            required
            maxLength={120}
            placeholder="Week-end à Strasbourg"
            aria-label="Nom de l'événement"
            className={`${field} col-span-2`}
          />
          <input
            type="date"
            name="eventDay"
            required
            aria-label="Jour"
            className={field}
          />
          <input
            type="date"
            name="eventEndDay"
            aria-label="Jusqu'au (facultatif)"
            title="Jusqu'au (facultatif)"
            className={field}
          />
          <input
            type="time"
            name="eventTime"
            aria-label="Heure (facultatif)"
            className={field}
          />
          <input
            name="eventPlace"
            maxLength={120}
            placeholder="Lieu (facultatif)"
            aria-label="Lieu"
            className={`${field} sm:col-span-3`}
          />
        </div>
      )}
      {kind === "citation" && (
        <div className="flex flex-col gap-2">
          <textarea
            name="quoteText"
            required
            maxLength={1000}
            rows={2}
            placeholder="« Chaque homme porte la forme entière de l'humaine condition. »"
            aria-label="Citation"
            className="w-full [field-sizing:content] resize-none rounded-lg bg-[#E8E1D6] p-3 font-serif italic text-lg focus:outline-none"
          />
          <input
            name="quoteSource"
            maxLength={200}
            placeholder="Montaigne, Essais"
            aria-label="Source"
            className={field}
          />
        </div>
      )}
      <AttachFile key={state.ok ?? 0} userId={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex p-1 rounded-full bg-lin text-[13px]"
          role="group"
          aria-label="Type de publication"
        >
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`h-8 px-3 rounded-full ${kind === k.id ? "bg-noir text-casse font-medium" : "text-encre"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <label className="flex items-center gap-2 h-10 pl-3.5 pr-2 rounded-full border border-noir/12 text-[13px]">
          <span className="text-doux">Pour</span>
          <select
            name="circleId"
            defaultValue={defaultCircle ?? circles[0]?.id}
            className="bg-transparent font-medium max-w-44 focus:outline-none"
          >
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "…" : "Publier"}
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function CommentForm({
  postId,
  circleId,
}: {
  postId: string;
  circleId: string;
}) {
  const [state, action, pending] = useActionState<CercleState, FormData>(
    comment,
    {},
  );
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="circleId" value={circleId} />
      <div className="flex gap-2">
        <input
          name="body"
          required
          maxLength={2000}
          placeholder="Répondre…"
          aria-label="Commenter"
          className={`${field} flex-1 min-w-0 rounded-full`}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-4 rounded-full border border-noir/15 text-sm hover:bg-lin disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function NewCircle() {
  const [state, action, pending] = useActionState<CercleState, FormData>(
    createCircle,
    {},
  );
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] underline underline-offset-4 text-encre hover:text-noir"
      >
        Créer
      </button>
    );
  return (
    <form
      action={action}
      className="basis-full rounded-xl bg-papier border border-noir/10 p-4 flex flex-col gap-3 mt-2"
    >
      <input
        name="name"
        required
        maxLength={60}
        placeholder="Coloc Oberkampf, Famille…"
        aria-label="Nom du cercle"
        className={field}
        autoFocus
      />
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Couleur</legend>
        {MOODS.map((m, i) => (
          <label key={m} title={MOOD_META[m].label} className="cursor-pointer">
            <input
              type="radio"
              name="color"
              value={m}
              defaultChecked={i === 1}
              className="peer sr-only"
            />
            <span
              className="block w-6 h-6 rounded-full peer-checked:ring-2 peer-checked:ring-noir peer-checked:ring-offset-2 peer-checked:ring-offset-papier peer-focus-visible:ring-2"
              style={{ background: MOOD_META[m].color }}
            />
          </label>
        ))}
      </fieldset>
      <FormError state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primary}>
          Créer le cercle
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

export function InviteToCircle({
  circleId,
  name,
}: {
  circleId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState<CercleState, FormData>(
    createCircleInvite,
    {},
  );
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {state.code ? (
        <div className="rounded-xl bg-noir text-casse p-4 flex flex-col gap-2">
          <p className="text-[11px] tracking-[.12em] uppercase text-casse/60">
            Code d'invitation
          </p>
          <p className="font-serif text-4xl tracking-[0.12em] select-all">
            {formatInviteCode(state.code)}
          </p>
          <p className="text-xs text-casse/70 leading-normal">
            Valable 48 h, jusqu'à 20 personnes. À entrer dans « Rejoindre avec
            un code ».
          </p>
          <button
            type="button"
            className="self-start h-8 px-3 rounded-full bg-casse text-noir text-xs font-medium"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `Rejoins notre cercle « ${name} » sur Anima avec le code ${formatInviteCode(state.code!)} (valable 48 h).`,
              );
              setCopied(true);
            }}
          >
            {copied ? "Message copié" : "Copier le message"}
          </button>
        </div>
      ) : null}
      <form action={action}>
        <input type="hidden" name="circleId" value={circleId} />
        <button
          type="submit"
          disabled={pending}
          className="w-full h-10 rounded-full border border-noir/15 text-sm font-medium hover:bg-lin disabled:opacity-50"
        >
          {pending
            ? "…"
            : state.code
              ? "Générer un autre code"
              : "Inviter quelqu'un"}
        </button>
      </form>
      <FormError state={state} />
    </div>
  );
}

/** Remet à zéro les nouveautés à l'ouverture, et rafraîchit quand un membre publie. */
export function LiveCircles({ circleId }: { circleId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    void markSeen(circleId);
  }, [circleId]);
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`cercles:${circleId ?? "tous"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_posts" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_comments" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, router]);
  return null;
}

export function SaveQuote({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<CercleState, FormData>(
    saveQuoteFromPost,
    {},
  );
  if (state.ok)
    return (
      <span className="text-[13px] text-doux">Gardée dans ta bibliothèque</span>
    );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[13px] text-doux hover:text-noir disabled:opacity-50"
      >
        Enregistrer dans ma bibliothèque
      </button>
      {state.error && <span className="text-xs text-terre">{state.error}</span>}
    </form>
  );
}
