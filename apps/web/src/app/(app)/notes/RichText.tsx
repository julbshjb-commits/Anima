/**
 * Mise en forme légère des passages, sans éditeur riche : une ligne « I. … »,
 * « 1) … » ou « ## … » devient un intertitre, une ligne « - » ou « • » une puce.
 * Le texte reste du texte (aucun HTML interprété).
 */
export function RichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length)
      out.push(
        <ul
          key={`l${k}`}
          className="list-disc pl-5 flex flex-col gap-1 marker:text-doux"
        >
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>,
      );
    list = [];
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    if (bullet) return void list.push(bullet[1]);
    flush(i);
    if (!line.trim()) return;
    const heading = line.match(
      /^(?:##\s+(.*)|((?:[IVX]+|[A-Z]|\d+)[.)]\s+.*))$/,
    );
    if (heading)
      out.push(
        <p key={i} className="font-semibold">
          {heading[1] ?? heading[2]}
        </p>,
      );
    else out.push(<p key={i}>{line}</p>);
  });
  flush(-1);
  return (
    <div className={`flex flex-col gap-1.5 break-words ${className}`}>
      {out}
    </div>
  );
}
