import { AI_SPACES, AI_SPACE_META, type AiSpace } from "@anima/core";

/** Cases à cocher des espaces ouverts aux assistants IA. Le journal intime est mis à part. */
export function AiSpacesPicker({ selected }: { selected: AiSpace[] }) {
  const usual = AI_SPACES.filter((s) => s !== "intime");
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Espaces ouverts</legend>
      {usual.map((s) => (
        <label key={s} className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="spaces" value={s} defaultChecked={selected.includes(s)} className="mt-1 size-4 accent-[var(--color-accent)]" />
          <span className="flex flex-col">
            <span className="text-sm font-medium">{AI_SPACE_META[s].label}</span>
            <span className="text-xs text-doux">{AI_SPACE_META[s].detail}</span>
          </span>
        </label>
      ))}
      <label className="flex items-start gap-3 cursor-pointer mt-2 pt-4 border-t border-trait">
        <input type="checkbox" name="spaces" value="intime" defaultChecked={selected.includes("intime")} className="mt-1 size-4 accent-[var(--color-terre)]" />
        <span className="flex flex-col">
          <span className="text-sm font-medium">{AI_SPACE_META.intime.label}</span>
          <span className="text-xs text-doux">{AI_SPACE_META.intime.detail}</span>
        </span>
      </label>
    </fieldset>
  );
}
