"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const CARTES = [
  { matiere: "Biologie", q: "Où se déroule la glycolyse ?", r: "Dans le cytoplasme de la cellule, sans besoin d'oxygène." },
  { matiere: "Histoire", q: "Que crée le traité de Rome, signé en 1957 ?", r: "La Communauté économique européenne (CEE)." },
  { matiere: "Anglais", q: "« To cram » veut dire…", r: "Bachoter : apprendre beaucoup en très peu de temps." },
  { matiere: "Droit", q: "Que pose l'article 1240 du Code civil ?", r: "Celui qui cause un dommage à autrui par sa faute doit le réparer." },
];

const NOTES = [
  { label: "À revoir", dans: "1 min" },
  { label: "Difficile", dans: "6 min" },
  { label: "Bien", dans: "1 j" },
  { label: "Facile", dans: "4 j" },
];

/**
 * Démo de révision sur la page d'accueil : une vraie petite séance qu'on peut
 * toucher. Elle avance seule tant qu'on n'y touche pas.
 */
export function DemoCarte() {
  const [i, setI] = useState(0);
  const [retournee, setRetournee] = useState(false);
  const [faites, setFaites] = useState(0);
  const [eclat, setEclat] = useState(0);
  const touchee = useRef(false);
  const carte = CARTES[i % CARTES.length]!;

  const noter = useCallback(() => {
    setEclat((e) => e + 1);
    setFaites((f) => f + 1);
    setRetournee(false);
    setTimeout(() => setI((n) => n + 1), 260);
  }, []);

  // Lecture automatique : question, réponse, « Bien », carte suivante.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => {
      if (touchee.current) return;
      if (!retournee) setRetournee(true);
      else noter();
    }, retournee ? 2600 : 2200);
    return () => clearTimeout(t);
  }, [retournee, i, noter]);

  const total = 12;
  const fait = Math.min(faites, total);

  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <div className="lueur lueur-1 w-64 h-64 bg-[#8a6a45]/50 -left-16 -top-10" aria-hidden />
      <div className="lueur lueur-2 w-72 h-72 bg-[#3d4650]/60 -right-20 bottom-0" aria-hidden />

      <div className="relative rounded-[32px] border border-trait bg-[#141415]/80 backdrop-blur-xl p-5 sm:p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="surtitre">Aujourd&apos;hui</span>
            <span className="titre text-2xl">
              {total - fait} cartes <em className="italic champagne">à revoir</em>
            </span>
          </div>
          <span className="text-xs text-champagne rounded-full border border-champagne/30 px-3 py-1.5 whitespace-nowrap">J-12 · Partiel</span>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#b98e52,#f3dcb0)] transition-[width] duration-700 ease-out" style={{ width: `${(fait / total) * 100}%` }} />
        </div>

        {/* La pile : deux cartes devinées derrière, la carte du moment devant. */}
        <div className="relative mt-6 h-[250px] sm:h-[270px] [perspective:1400px]">
          <div className="absolute inset-x-6 top-4 bottom-[-14px] rounded-[26px] bg-white/[0.025] border border-white/[0.04]" aria-hidden />
          <div className="absolute inset-x-3 top-2 bottom-[-7px] rounded-[26px] bg-white/[0.04] border border-white/[0.05]" aria-hidden />
          <button
            key={`carte-${i}`}
            type="button"
            onClick={() => {
              touchee.current = true;
              setRetournee((r) => !r);
            }}
            aria-label={retournee ? `Réponse : ${carte.r}. Toucher pour revoir la question.` : `Question : ${carte.q}. Toucher pour voir la réponse.`}
            className="arrive absolute inset-0 rounded-[26px] text-left [transform-style:preserve-3d] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] cursor-pointer"
            style={{ transform: retournee ? "rotateY(180deg)" : "none" }}
          >
            <span className="absolute inset-0 rounded-[26px] border border-trait bg-[linear-gradient(160deg,#232325,#19191a)] p-6 flex flex-col [backface-visibility:hidden]">
              <span className="surtitre">{carte.matiere} · Question</span>
              <span className="titre text-[28px] sm:text-[31px] leading-[1.15] mt-auto mb-auto">{carte.q}</span>
              <span className="text-xs text-doux">Touche la carte pour la retourner</span>
            </span>
            <span className="absolute inset-0 rounded-[26px] border border-champagne/25 bg-[linear-gradient(160deg,#2a2620,#1a1816)] p-6 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="surtitre !text-champagne/80">{carte.matiere} · Réponse</span>
              <span className="titre italic text-[25px] sm:text-[28px] leading-[1.2] mt-auto mb-auto">{carte.r}</span>
              <span className="text-xs text-doux">Comment c&apos;était ?</span>
            </span>
          </button>
          {eclat > 0 && <span key={`eclat-${eclat}`} className="eclat-carte" aria-hidden />}
        </div>

        <div className={`mt-8 grid grid-cols-4 gap-2 transition-opacity duration-300 ${retournee ? "opacity-100" : "opacity-40"}`}>
          {NOTES.map((n) => (
            <button
              key={n.label}
              type="button"
              disabled={!retournee}
              onClick={() => {
                touchee.current = true;
                noter();
              }}
              className={`choix rounded-2xl border px-1 py-2.5 flex flex-col items-center gap-0.5 disabled:cursor-default ${
                n.label === "Bien" ? "border-champagne/40 bg-champagne/[0.08]" : "border-trait bg-white/[0.02]"
              }`}
            >
              <span className="text-[13px] font-medium">{n.label}</span>
              <span className="text-[11px] text-doux">{n.dans}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Petites bulles qui flottent autour de la démo. */}
      <div className="berce absolute -left-4 sm:-left-14 top-24 hidden min-[420px]:flex items-center gap-2 rounded-full border border-trait bg-[#1a1a1b]/90 backdrop-blur px-3.5 py-2 text-xs shadow-xl" aria-hidden>
        <span className="flamme">🔥</span> 7 jours d&apos;affilée
      </div>
      <div className="berce absolute -right-3 sm:-right-12 bottom-28 hidden min-[420px]:flex items-center gap-2 rounded-full border border-trait bg-[#1a1a1b]/90 backdrop-blur px-3.5 py-2 text-xs shadow-xl [animation-delay:-2.5s]" aria-hidden>
        <span className="w-1.5 h-1.5 rounded-full bg-sauge pouls" /> Ta promo révise aussi
      </div>
    </div>
  );
}
