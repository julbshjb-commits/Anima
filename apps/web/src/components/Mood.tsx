import { MOOD_META, type Mood } from "@anima/core";

export function MoodDot({ mood, size = 10 }: { mood: Mood; size?: number }) {
  const m = MOOD_META[mood];
  return (
    <span
      title={m.label}
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: m.color }}
    />
  );
}
