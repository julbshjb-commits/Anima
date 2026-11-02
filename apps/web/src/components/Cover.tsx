import { coverOf } from "@anima/core";

/** Couverture d'un carnet : dégradé de la collection, tranche visible. */
export function Cover({ cover, title, className = "" }: { cover: string; title?: string; className?: string }) {
  const c = coverOf(cover);
  return (
    <span
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title ? `Couverture ${c.label}` : undefined}
      className={`block aspect-[3/4] rounded-[3px_10px_10px_3px] shadow-[inset_5px_0_0_rgba(0,0,0,.18),0_18px_30px_-22px_rgba(21,21,21,.6)] ${className}`}
      style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}
    />
  );
}
