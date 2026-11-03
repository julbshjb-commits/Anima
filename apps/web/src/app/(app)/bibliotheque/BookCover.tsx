import { coverOf } from "@anima/core";

/** Couverture d'œuvre, d'après la maquette : titre en haut, filet et créateur en bas, tranche à gauche. */
export function BookCover({
  cover,
  title,
  creator,
  className = "",
}: {
  cover: string;
  title: string;
  creator?: string | null;
  className?: string;
}) {
  const c = coverOf(cover);
  const light = c.fg === "#151515";
  return (
    <span
      aria-hidden
      className={`@container relative block aspect-[2/3] ${className}`}
    >
      <span
        className="absolute inset-0 rounded-[3px] flex flex-col justify-between p-[9cqw] overflow-hidden"
        style={{
          background: c.bg,
          color: c.fg,
          boxShadow: `inset 3.5cqw 0 0 rgba(0,0,0,${light ? 0.08 : 0.25}), 0 12px 24px -14px rgba(21,21,21,.5)`,
        }}
      >
        <span className="font-serif leading-[1.1] text-[13cqw] line-clamp-4 break-words">
          {title}
        </span>
        {creator && (
          <span className="flex flex-col gap-[4cqw]">
            <i
              className="block w-[22cqw] h-px"
              style={{ background: c.fg, opacity: 0.6 }}
            />
            <span className="uppercase tracking-[.12em] text-[7.5cqw] leading-tight line-clamp-2">
              {creator}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}

export function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span
      className="text-[11px] tracking-[.1em] text-encre"
      aria-label={`${n} sur 5`}
    >
      {"★".repeat(n)}
      <span className="text-noir/25">{"★".repeat(5 - n)}</span>
    </span>
  );
}
