/** Photo de profil du réseau : l'image, sinon une pastille d'initiale dorée ou graphite. */
const TONES = [
  "bg-[linear-gradient(135deg,#ecd4a6,#b38c55)] text-nuit",
  "bg-[linear-gradient(135deg,#e6e1d9,#9b958c)] text-nuit",
  "bg-[linear-gradient(135deg,#6b7480,#2f353c)] text-blanc",
  "bg-[linear-gradient(135deg,#8fb39a,#4d6b57)] text-blanc",
];

function tone(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

export function ProfilePic({
  name,
  handle,
  src,
  size = 40,
  ring = false,
}: {
  name: string;
  handle: string;
  src: string | null;
  size?: number;
  ring?: boolean;
}) {
  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="rounded-full object-cover w-full h-full" />
  ) : (
    <span
      className={`grid place-items-center w-full h-full rounded-full font-semibold ${tone(handle)}`}
      style={{ fontSize: Math.round(size * 0.4) }}
    >
      {(name.trim().charAt(0) || "?").toLocaleUpperCase("fr-FR")}
    </span>
  );
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${ring ? "p-[2px] anneau-neuf" : ""}`}
      style={{ width: size + (ring ? 4 : 0), height: size + (ring ? 4 : 0) }}
    >
      <span className={`block w-full h-full rounded-full overflow-hidden ${ring ? "border-2 border-fond" : ""}`}>{inner}</span>
    </span>
  );
}
