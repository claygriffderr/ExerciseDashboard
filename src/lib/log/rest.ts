import { z } from "zod";

/**
 * Rest timer settings and rules.
 *
 * Wendler gives no rest times for 5/3/1. The defaults follow the r/Fitness
 * "5/3/1 for Beginners" guide: most people rest 1.5 to 3 minutes between sets,
 * less for warm-ups ("minimal rest"), First Set Last / volume sets and
 * assistance work. Heavy main sets get the top of that range.
 */

export const REST_KEYS = ["WARMUP", "MAIN", "SUPPLEMENTAL", "ACCESSORY", "BETWEEN"] as const;
export type RestKey = (typeof REST_KEYS)[number];
export type Section = Exclude<RestKey, "BETWEEN">;

export const REST_DEFAULTS: Record<RestKey, number> = {
  WARMUP: 60,
  MAIN: 180,
  SUPPLEMENTAL: 90,
  ACCESSORY: 60,
  BETWEEN: 120,
};

export const REST_LABELS: Record<RestKey, string> = {
  WARMUP: "Warm-up sets",
  MAIN: "Main sets",
  SUPPLEMENTAL: "Volume sets",
  ACCESSORY: "Assistance sets",
  BETWEEN: "Between exercises",
};

/** Durations offered in the picker, in seconds. */
export const REST_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300] as const;

export type RestSettings = { enabled: boolean; seconds: Record<RestKey, number> };

const seconds = z.number().int().min(15).max(600);
export const restSettingsSchema = z.object({
  enabled: z.boolean(),
  seconds: z.object(Object.fromEntries(REST_KEYS.map((k) => [k, seconds])) as Record<RestKey, typeof seconds>),
});

/** The saved JSON from the profile, with defaults for anything missing or broken. */
export function parseRestSettings(json: string | null | undefined): RestSettings {
  let raw: unknown = {};
  try {
    raw = json ? JSON.parse(json) : {};
  } catch {
    raw = {};
  }
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const saved = obj.seconds && typeof obj.seconds === "object" ? (obj.seconds as Record<string, unknown>) : {};
  const out = { ...REST_DEFAULTS };
  for (const k of REST_KEYS) {
    const v = saved[k];
    if (seconds.safeParse(v).success) out[k] = v as number;
  }
  return { enabled: obj.enabled !== false, seconds: out };
}

/** "1 min", "1½ min", "45 s" for pickers and summaries. */
export function formatDuration(s: number): string {
  if (s < 60) return `${s} s`;
  const min = s / 60;
  if (Number.isInteger(min)) return `${min} min`;
  if (Number.isInteger(min * 2)) return `${Math.floor(min)}½ min`;
  return formatClock(s);
}

/** "2:05" for the running timer. */
export function formatClock(s: number): string {
  const whole = Math.max(0, Math.ceil(s));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

type ExerciseLike = { name: string; exerciseId: string; section: Section; sets: { done: boolean }[] };

export type RestPlan = { key: RestKey; label: string };

/**
 * What rest to time after a set in exercise `index` was ticked, given the
 * exercises as they are after the tick. Sets left in this exercise get its
 * section's rest. Moving on to more sets of the same lift (warm-up to main
 * sets, main to volume) keeps that rest too; a different exercise gets the
 * between-exercises rest. Nothing left to do means no timer.
 */
export function restAfterTick(exercises: ExerciseLike[], index: number): RestPlan | null {
  const e = exercises[index];
  if (!e) return null;
  if (e.sets.some((s) => !s.done)) return { key: e.section, label: "Before your next set" };
  const open = (x: ExerciseLike) => x.sets.some((s) => !s.done);
  const next = exercises.slice(index + 1).find(open) ?? exercises.slice(0, index).find(open);
  if (!next) return null;
  if (next.exerciseId === e.exerciseId) {
    return { key: e.section, label: `Before your ${REST_LABELS[next.section].toLowerCase()}` };
  }
  return { key: "BETWEEN", label: `Before ${next.name}` };
}
