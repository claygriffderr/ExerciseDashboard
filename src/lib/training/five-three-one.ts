/**
 * Core 5/3/1 math (Jim Wendler). Percentages are of the training max (TM),
 * not of the one-rep max.
 */

export type LiftSlot = "squat" | "bench" | "deadlift" | "press";

export const LIFT_SLOTS: { slot: LiftSlot; label: string; body: "upper" | "lower" }[] = [
  { slot: "squat", label: "Squat", body: "lower" },
  { slot: "bench", label: "Bench press", body: "upper" },
  { slot: "deadlift", label: "Deadlift", body: "lower" },
  { slot: "press", label: "Overhead press", body: "upper" },
];

export function slotBody(slot: LiftSlot): "upper" | "lower" {
  return LIFT_SLOTS.find((s) => s.slot === slot)!.body;
}

export type SetScheme = {
  /** Fraction of the training max, e.g. 0.65. */
  percent: number;
  reps: number;
  /** "As many reps as possible" set, written 5+ in 5/3/1. */
  amrap?: boolean;
};

/** Standard warm-up before the work sets. */
export const WARMUP_SETS: SetScheme[] = [
  { percent: 0.4, reps: 5 },
  { percent: 0.5, reps: 5 },
  { percent: 0.6, reps: 3 },
];

/** The classic four-week wave. Week 4 is the deload. */
export const WAVE: Record<1 | 2 | 3 | 4, { name: string; sets: SetScheme[] }> = {
  1: {
    name: "5s week",
    sets: [
      { percent: 0.65, reps: 5 },
      { percent: 0.75, reps: 5 },
      { percent: 0.85, reps: 5, amrap: true },
    ],
  },
  2: {
    name: "3s week",
    sets: [
      { percent: 0.7, reps: 3 },
      { percent: 0.8, reps: 3 },
      { percent: 0.9, reps: 3, amrap: true },
    ],
  },
  3: {
    name: "5/3/1 week",
    sets: [
      { percent: 0.75, reps: 5 },
      { percent: 0.85, reps: 3 },
      { percent: 0.95, reps: 1, amrap: true },
    ],
  },
  4: {
    name: "Deload week",
    sets: [
      { percent: 0.4, reps: 5 },
      { percent: 0.5, reps: 5 },
      { percent: 0.6, reps: 5 },
    ],
  },
};

/** First work-set percentage each week (used for First Set Last volume). */
export const FIRST_SET_PERCENT: Record<1 | 2 | 3 | 4, number> = { 1: 0.65, 2: 0.7, 3: 0.75, 4: 0.4 };

/** Reps you should beat on the last set of each week before calling it a good set. */
export const AMRAP_GOALS: Record<1 | 2 | 3, string> = { 1: "8 to 12", 2: "5 to 8", 3: "3 to 5" };

export type WaveStyle = "classic" | "fives-pro";

/**
 * Work sets for one week. "fives-pro" keeps the same percentages but makes
 * every set 5 reps with no all-out last set, a gentler option.
 */
export function workSets(week: 1 | 2 | 3 | 4, style: WaveStyle = "classic"): SetScheme[] {
  const sets = WAVE[week].sets;
  if (style === "classic" || week === 4) return sets.map((s) => ({ ...s }));
  return sets.map((s) => ({ percent: s.percent, reps: 5 }));
}

/**
 * Estimated one-rep max from a set of `reps` at `weight` (Wendler's formula,
 * weight × reps × 0.0333 + weight). Reliable up to about 10 reps.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  return weight * reps * 0.0333 + weight;
}

/**
 * Estimate a one-rep max from a set stopped short of failure. Counting the
 * reps left in the tank as if they were done is the reps-in-reserve method.
 */
export function estimateOneRepMaxFromSubmax(weight: number, reps: number, repsInReserve: number): number {
  return estimateOneRepMax(weight, reps + Math.max(0, repsInReserve));
}

/** Training max as a fraction of the one-rep max (90% classic, 85% for beginners). */
export function trainingMaxFromOneRepMax(oneRepMax: number, fraction = 0.9): number {
  return Math.round(oneRepMax * fraction * 100) / 100;
}

export type ProgressionIncrements = { upper: number; lower: number };

export const STANDARD_INCREMENTS: ProgressionIncrements = { upper: 5, lower: 10 };
export const GENTLE_INCREMENTS: ProgressionIncrements = { upper: 5, lower: 5 };

/** Training max for the next cycle. */
export function nextTrainingMax(tm: number, slot: LiftSlot, increments = STANDARD_INCREMENTS): number {
  return tm + (slotBody(slot) === "upper" ? increments.upper : increments.lower);
}

/** When you miss the minimum reps on a last set, drop the training max 10% and build back up. */
export function resetTrainingMax(tm: number, fraction = 0.1): number {
  return Math.round(tm * (1 - fraction) * 100) / 100;
}

/** True when the last-set reps fell short of what the week asked for. */
export function missedMinimumReps(week: 1 | 2 | 3, repsDone: number): boolean {
  return repsDone < WAVE[week].sets[2].reps;
}
