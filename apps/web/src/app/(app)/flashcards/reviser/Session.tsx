"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LEARN_AHEAD_MS, RATINGS, nextSchedule, previewDelays, renderCloze, type Rating } from "@anima/core";
import type { StudyItem } from "@/lib/flashcards";
import { finishSession, recordReview } from "@/app/(app)/(menu)/flashcards/actions";

/** Teintes des réponses : « Bien », la plus fréquente, est en or. */
const TONES: Record<Rating, { button: string; sub: string }> = {
  1: { button: "border border-[#e2774f]/45 bg-[#e2774f]/[.08] hover:bg-[#e2774f]/[.14]", sub: "text-[#d4a896]" },
  2: { button: "border border-blanc/15 bg-blanc/[.03] hover:bg-blanc/[.07]", sub: "text-doux" },
  3: { button: "bouton-or text-nuit font-semibold shadow-[0_14px_40px_-14px_rgba(224,184,120,.7)]", sub: "text-[#5a4a2c]" },
  4: { button: "border border-[#78aadc]/45 bg-[#78aadc]/[.08] hover:bg-[#78aadc]/[.14]", sub: "text-[#a8bfd4]" },
};

/**
 * Séance de révision : une carte à la fois, on la retourne, on dit si on s'en
 * souvenait. Les cartes ratées reviennent dans la même séance quelques minutes
 * plus tard. Clavier : Espace pour retourner, 1 à 4 pour répondre.
 * Tactile : toucher pour retourner, glisser à droite « Bien », à gauche « À revoir ».
 */
export function Session({
  initial,
  goal,
  doneBefore,
  streak,
  backHref,
}: {
  initial: StudyItem[];
  goal: number;
  doneBefore: number;
  streak: number;
  backHref: string;
}) {
  const [queue, setQueue] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [tally, setTally] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<null | "gauche" | "droite" | "haut">(null);
  const [burst, setBurst] = useState<{ n: number; miss: boolean } | null>(null);
  const shownAt = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const touch = useRef<{ x: number; y: number } | null>(null);
  const total = initial.length;
  const item = queue[0];

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const delays = useMemo(() => (item ? previewDelays(item.schedule) : null), [item]);

  const rate = useCallback(
    (rating: Rating) => {
      if (!item || !revealed || leaving) return;
      const now = new Date();
      const elapsed = shownAt.current ? Date.now() - shownAt.current : null;
      const next = nextSchedule(item.schedule, rating, now, () => 0.5);
      // Enregistrement en arrière-plan, dans l'ordre des réponses.
      chain.current = chain.current.then(() =>
        recordReview(item.id, rating, elapsed).then((r) => {
          if (r.error) setError(r.error);
        }),
      );
      setLeaving(rating === 1 ? "gauche" : rating >= 3 ? "droite" : "haut");
      setBurst({ n: Date.now(), miss: rating === 1 });
      setTimeout(() => {
        setQueue((q) => {
          const rest = q.slice(1);
          const again = Date.parse(next.due_at) - Date.now() <= LEARN_AHEAD_MS;
          if (!again) return rest;
          // La carte revient un peu plus loin dans la séance.
          const back = { ...item, schedule: { ...item.schedule, ...next } };
          const at = Math.min(rest.length, rating === 1 ? 3 : 6);
          return [...rest.slice(0, at), back, ...rest.slice(at)];
        });
        setDone((n) => n + 1);
        setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
        setRevealed(false);
        setLeaving(null);
        setDrag(0);
        shownAt.current = Date.now();
      }, 260);
    },
    [item, revealed, leaving],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        else rate(3);
      } else if (["1", "2", "3", "4"].includes(e.key) && revealed) {
        rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, rate]);

  const finished = !item;
  useEffect(() => {
    if (finished && done > 0) chain.current.then(() => finishSession());
  }, [finished, done]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 800);
    return () => clearTimeout(t);
  }, [burst]);

  const progress = total ? Math.min(100, Math.round((done / Math.max(total, done + queue.length)) * 100)) : 100;

  return (
    <div className="relative isolate min-h-dvh flex flex-col overflow-hidden">
      <span aria-hidden className="lueur lueur-1 -z-10 w-[560px] h-[560px] left-[22%] top-[12%] bg-[rgba(230,200,145,0.13)]" />
      <span aria-hidden className="lueur lueur-2 -z-10 w-[420px] h-[420px] -right-24 -top-36 bg-[rgba(140,150,160,0.12)]" />
      <header className="relative h-16 px-5 lg:px-10 flex items-center gap-4">
        <Link href={backHref} className="h-9 px-4 rounded-full border border-trait grid place-items-center text-sm hover:bg-lin" aria-label="Quitter la séance">
          Quitter
        </Link>
        <div className="flex-1 h-1 rounded-full bg-blanc/[.08]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <i className="block h-full rounded-full bg-[linear-gradient(90deg,#c99a5a,#f3dcb0)] shadow-[0_0_12px_rgba(230,200,145,.6)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-doux tabular-nums whitespace-nowrap">{queue.length} restante{queue.length > 1 ? "s" : ""}</span>
      </header>

      {finished ? (
        <End done={done} tally={tally} goal={goal} doneBefore={doneBefore} streak={streak} backHref={backHref} />
      ) : (
        <main className="relative flex-1 flex flex-col items-center justify-center gap-8 px-5 pb-10">
          <p className="surtitre">{item.deckTitle}</p>
          <div
            className="relative w-full max-w-[640px] select-none touch-pan-y"
            onClick={() => !revealed && setRevealed(true)}
            onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
            onTouchMove={(e) => {
              if (!touch.current || !revealed) return;
              const dx = e.touches[0]!.clientX - touch.current.x;
              if (Math.abs(dx) > Math.abs(e.touches[0]!.clientY - touch.current.y)) setDrag(dx);
            }}
            onTouchEnd={() => {
              if (revealed && Math.abs(drag) > 90) rate(drag > 0 ? 3 : 1);
              else setDrag(0);
              touch.current = null;
            }}
          >
            {/* Chaque carte arrive, puis flotte doucement ; la perspective porte sur la carte elle-même. */}
            <div key={`${item.id}-${done}`} className="arrive">
              <div className="berce [perspective:1600px]">
                <div
                  className="relative w-full min-h-[340px] sm:min-h-[380px] transition-transform duration-[650ms] [transform-style:preserve-3d] [transition-timing-function:cubic-bezier(.2,.8,.2,1)]"
                  style={{
                    transform: `${leaving === "gauche" ? "translateX(-120%) rotate(-8deg)" : leaving === "droite" ? "translateX(120%) rotate(8deg)" : leaving === "haut" ? "translateY(-60%) scale(.9)" : `translateX(${drag}px) rotate(${drag / 30}deg)`} rotateY(${revealed ? 180 : 0}deg)`,
                    opacity: leaving ? 0 : 1,
                    transitionProperty: drag && !leaving ? "none" : "transform, opacity",
                  }}
                >
                  <Face side="question" item={item} />
                  <Face side="reponse" item={item} back />
                </div>
              </div>
            </div>
            {burst && <span key={burst.n} aria-hidden className={`eclat ${burst.miss ? "!border-[#e2774f]/60" : ""}`} />}
          </div>

          <div className="w-full max-w-[640px] min-h-[92px]">
            {!revealed ? (
              <button type="button" onClick={() => setRevealed(true)} className="choix w-full h-14 rounded-2xl bg-blanc/[.04] border border-champagne/25 text-[15px] font-medium hover:bg-blanc/[.07]">
                Voir la réponse <span className="hidden lg:inline text-doux text-xs ml-2">Espace</span>
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:gap-3 animate-monte">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => rate(r.value)}
                    className={`choix h-[72px] rounded-2xl flex flex-col items-center justify-center gap-1 text-blanc ${TONES[r.value].button}`}
                  >
                    <span className="text-[14px] font-medium">{r.label}</span>
                    <span className={`text-[11px] tabular-nums ${TONES[r.value].sub}`}>
                      {delays?.[r.value]}
                      <span className="hidden lg:inline"> · {r.key}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-center text-[11px] text-doux lg:hidden">{revealed ? "Glisse à droite si tu savais, à gauche sinon." : "Touche la carte pour la retourner."}</p>
            {error && <p role="alert" className="mt-3 text-center text-xs text-terre">{error}</p>}
          </div>
        </main>
      )}
    </div>
  );
}

function Face({ side, item, back }: { side: "question" | "reponse"; item: StudyItem; back?: boolean }) {
  const c = item.card;
  const reversed = c.kind === "inversee" && item.variant === 1;
  return (
    <div
      className={`absolute inset-0 rounded-[28px] border p-8 sm:p-12 flex flex-col [backface-visibility:hidden] [-webkit-backface-visibility:hidden] overflow-hidden ${
        back
          ? "[transform:rotateY(180deg)] border-champagne/45 bg-[linear-gradient(160deg,rgba(230,200,145,.14),rgba(230,200,145,.03)),rgba(20,20,21,.86)] shadow-[0_50px_100px_-40px_rgba(230,200,145,.35),inset_0_1px_0_rgba(255,255,255,.1)]"
          : "border-champagne/25 bg-[linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.015)),rgba(20,20,21,.78)] shadow-[0_50px_100px_-50px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.08)]"
      }`}
    >
      <span aria-hidden className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl ${back ? "bg-champagne/15" : "bg-champagne/[.07]"}`} />
      <p className={`surtitre relative ${back ? "!text-[#c9b083]" : ""}`}>{side === "question" ? (reversed ? "Verso → recto" : "Question") : "Réponse"}</p>
      <div className="relative flex-1 flex flex-col justify-center gap-5 py-6">
        {c.kind === "trous" ? (
          <p className="font-serif text-[24px] sm:text-[30px] leading-snug text-center whitespace-pre-wrap">
            {renderCloze(c.front, item.variant, side).map((s, i) =>
              s.hole === "cache" ? (
                <span key={i} className="mx-0.5 px-2 rounded-md bg-champagne/15 text-champagne">{s.text}</span>
              ) : s.hole === "revele" ? (
                <span key={i} className="px-1 rounded-md bg-champagne/20 text-champagne font-medium">{s.text}</span>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
        ) : side === "question" ? (
          <p className="font-serif text-[26px] sm:text-[34px] leading-snug text-center whitespace-pre-wrap">{reversed ? c.back : c.front}</p>
        ) : (
          <>
            <p className="text-[15px] text-doux text-center whitespace-pre-wrap line-clamp-3">{reversed ? c.back : c.front}</p>
            <span aria-hidden className="mx-auto w-10 h-px bg-champagne/40" />
            <p className="font-serif text-[26px] sm:text-[34px] leading-snug text-center whitespace-pre-wrap text-[#f3dcb0]">{reversed ? c.front : c.back}</p>
          </>
        )}
        {side === "reponse" && c.kind === "trous" && c.back && <p className="text-sm text-doux text-center whitespace-pre-wrap">{c.back}</p>}
      </div>
      {side === "reponse" && c.note_id && (
        <Link href={`/notes/${c.note_id}`} onClick={(e) => e.stopPropagation()} className="relative self-center text-xs text-doux underline underline-offset-4 hover:text-noir">
          Revoir la note d'origine
        </Link>
      )}
    </div>
  );
}

function End({
  done,
  tally,
  goal,
  doneBefore,
  streak,
  backHref,
}: {
  done: number;
  tally: Record<Rating, number>;
  goal: number;
  doneBefore: number;
  streak: number;
  backHref: string;
}) {
  const today = done + doneBefore;
  const remembered = done ? Math.round(((done - tally[1]) / done) * 100) : 0;
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-7 px-5 pb-16 text-center">
      <p className="surtitre arrive !text-[#c9b083]">{done ? "Séance terminée" : "Rien à réviser"}</p>
      <h1 style={{ ["--i" as string]: 1 }} className="entree titre text-[44px] sm:text-[64px] leading-[1.02] max-w-2xl">
        {done ? (
          <span className="chiffre-or">
            {done} réponse{done > 1 ? "s" : ""}, {remembered} % retenues
          </span>
        ) : (
          "Tout est à jour. Les prochaines cartes arriveront au bon moment."
        )}
      </h1>
      {done > 0 && streak > 1 && (
        <p style={{ ["--i" as string]: 2 }} className="entree flex items-center gap-2 text-[17px]">
          <svg className="flamme" width="14" height="16" viewBox="0 0 14 16" aria-hidden>
            <path d="M7 0C8 4 13 6 13 10.5A6 6 0 0 1 1 10.5C1 8 3 6.5 4 5c.5 2 1.5 3 2.5 3C6 5 6 2.5 7 0z" fill="#e2774f" />
          </svg>
          Bravo, {streak} jours d'affilée
        </p>
      )}
      {done > 0 && (
        <dl className="flex gap-6 sm:gap-8 text-sm">
          {RATINGS.map((r, i) => (
            <div key={r.value} style={{ ["--i" as string]: 3 + i }} className="entree flex flex-col items-center gap-1">
              <dd className="titre text-[30px] leading-none">{tally[r.value]}</dd>
              <dt className="text-xs text-doux">{r.label}</dt>
            </div>
          ))}
        </dl>
      )}
      <p style={{ ["--i" as string]: 7 }} className="entree text-doux">
        {today >= goal ? `Objectif du jour atteint (${today} / ${goal}).` : `${today} / ${goal} pour l'objectif du jour.`}
      </p>
      <Link
        href={backHref}
        style={{ ["--i" as string]: 8 }}
        className="entree bouton-or inline-flex items-center h-12 px-7 rounded-full text-nuit text-sm font-semibold shadow-[0_14px_40px_-12px_rgba(224,184,120,.7)]"
      >
        Revenir aux paquets
      </Link>
    </main>
  );
}
