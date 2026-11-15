import { WAVE } from "../training/five-three-one";
import type { ProgramDefinition } from "../training/programs/types";
import { addDays } from "../training/schedule";
import { formatLong } from "../dates";

/** "5/3/1 for Beginners · 3s week" or "Learn the lifts · Week 2". */
export function workoutLabel(program: ProgramDefinition | null, phase: string | null, week: number | null): string {
  const phaseName = program?.phases.find((p) => p.key === phase)?.name;
  if (phase === "main" && week && week in WAVE) {
    const wave = WAVE[week as 1 | 2 | 3 | 4].name;
    return phaseName ? `${phaseName} · ${wave}` : wave;
  }
  if (phase === "find") return phaseName ?? "Test session";
  return [phaseName, week ? `Week ${week}` : null].filter(Boolean).join(" · ");
}

/** "Today", "Tomorrow" or "Wednesday, November 18". */
export function relativeDay(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatLong(date);
}
