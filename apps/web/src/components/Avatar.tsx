/** Pastilles d'initiales des membres, comme la « pile d'avatars » du design system. */
const TONES = [
  "bg-[linear-gradient(135deg,#ecd4a6,#b38c55)] text-nuit",
  "bg-[linear-gradient(135deg,#efbfb5,#b46f7c)] text-nuit",
  "bg-[linear-gradient(135deg,#a597cf,#54467f)] text-blanc",
];

export function initial(name: string | null | undefined) {
  return (name?.trim().charAt(0) || "?").toLocaleUpperCase("fr-FR");
}

export function Avatar({ name, index = 0, size = 32 }: { name: string; index?: number; size?: number }) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TONES[index % TONES.length]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial(name)}
    </span>
  );
}

/** Jusqu'à trois pastilles qui se chevauchent, puis « +n ». */
export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const shown = names.length > max ? names.slice(0, max - 1) : names;
  const rest = names.length - shown.length;
  return (
    <span className="flex shrink-0" aria-label={names.join(", ")}>
      {shown.map((n, i) => (
        <span key={i} className={`rounded-full border-2 border-fond ${i ? "-ml-2" : ""}`}>
          <Avatar name={n} index={i} size={22} />
        </span>
      ))}
      {rest > 0 && (
        <span className="-ml-2 rounded-full border-2 border-fond">
          <span className="inline-flex w-[22px] h-[22px] items-center justify-center rounded-full bg-sable text-[9px] font-semibold">
            +{rest}
          </span>
        </span>
      )}
    </span>
  );
}
