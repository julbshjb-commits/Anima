import type { CSSProperties } from "react";
import { JOURNAL_KIND_LABELS, coverOf, type JournalKind } from "@anima/core";

type Props = {
  cover: string;
  /** Titre imprimé sur la couverture. Sans titre : simple aplat (vignettes). */
  title?: string;
  kind?: JournalKind;
  className?: string;
};

const serif = "font-serif font-normal leading-[1.05]";

/**
 * Couverture d'un journal, d'après la galerie du design system : un aplat, une
 * tranche plus sombre à gauche, et le titre placé selon la collection. Les
 * tailles suivent la largeur de la couverture (unités cqw).
 */
export function Cover({ cover, title, kind, className = "" }: Props) {
  const c = coverOf(cover);
  const light = c.fg === "#151515";
  const style: CSSProperties = {
    background: c.bg,
    color: c.fg,
    boxShadow: `inset 3.5cqw 0 0 rgba(0,0,0,${light ? 0.08 : 0.22}), 0 12px 28px -14px rgba(21,21,21,.45)`,
  };
  // Le conteneur porte la taille ; la face (enfant) se dessine en unités cqw.
  return (
    <span aria-hidden className={`@container relative block aspect-[3/4] ${className}`}>
      <span
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[2cqw_6cqw_6cqw_2cqw] p-[10.5cqw]"
        style={style}
      >
        {title && inner(c.style, title, kind)}
      </span>
    </span>
  );
}

function inner(style: string, title: string, kind?: JournalKind) {
  switch (style) {
    case "classique":
      return (
        <span className="m-auto flex flex-col items-center gap-[5cqw] text-center">
          <span className="w-[17cqw] h-px bg-sable" />
          <span className={`${serif} text-[13.5cqw]`}>{title}</span>
          <span className="w-[17cqw] h-px bg-sable" />
        </span>
      );
    case "editorial":
      return (
        <span className="flex-1 flex flex-col justify-between">
          <span className="text-[5.2cqw] tracking-[.2em] uppercase">{kind ? JOURNAL_KIND_LABELS[kind] : "Anima"}</span>
          <span className={`${serif} italic text-[15.5cqw]`}>{title}</span>
        </span>
      );
    case "vintage":
      return (
        <span className={`m-auto border border-[rgba(232,225,214,.6)] px-[6cqw] py-[8cqw] text-center ${serif} text-[12.5cqw]`}>{title}</span>
      );
    case "moderne":
      return <span className="font-sans font-semibold text-[10.5cqw] leading-[1.1] tracking-[-.01em]">{title}</span>;
    case "artistique":
      return (
        <>
          <span className="absolute -top-[10cqw] -right-[10cqw] w-[50cqw] h-[50cqw] rounded-full bg-[#D6A9A0]" />
          <span className="absolute top-[22cqw] left-[12cqw] w-[38cqw] h-[64cqw] bg-[#D9D6CF] rotate-[-14deg]" />
          <span className={`relative mt-auto ${serif} text-[13.5cqw]`}>{title}</span>
        </>
      );
    case "abstrait":
      return (
        <>
          <span className="absolute top-[12cqw] left-[7cqw] w-[78cqw] h-[78cqw] rounded-full border border-noir/35" />
          <span className="absolute top-[44cqw] left-[37cqw] w-[50cqw] h-[50cqw] rounded-full border border-noir/35" />
          <span className={`relative mt-auto ${serif} text-[13.5cqw]`}>{title}</span>
        </>
      );
    default:
      return <span className={`mt-auto ${serif} text-[13.5cqw]`}>{title}</span>;
  }
}
