import {
  LIFT_SLOTS,
  estimateOneRepMaxFromSubmax,
  nextTrainingMax,
  resetTrainingMax,
  trainingMaxFromOneRepMax,
  type LiftSlot,
  type ProgressionIncrements,
} from "./five-three-one";
import type { TrainingMaxes } from "./programs/types";

/**
 * Turn the beginner on-ramp's test set (5 reps with about 2 in reserve) into
 * a training max, rounded down to a whole 5 lb so the first cycle is easy.
 */
export function trainingMaxFromTestSet(weight: number, reps: number, repsInReserve: number, fraction: number): number {
  const estimate = estimateOneRepMaxFromSubmax(weight, reps, repsInReserve);
  return Math.floor(trainingMaxFromOneRepMax(estimate, fraction) / 5) * 5;
}

export type CycleOutcome = {
  /** True if any last set fell short of the week's minimum reps (or prescribed reps were missed). */
  missedReps: boolean;
};

export type TrainingMaxChange = { slot: LiftSlot; from: number; to: number; reason: "progress" | "reset" };

/**
 * Training maxes for the next cycle. Lifts that hit their reps go up by the
 * increment; lifts that fell short drop 10% to rebuild.
 */
export function progressTrainingMaxes(
  current: TrainingMaxes,
  outcomes: Partial<Record<LiftSlot, CycleOutcome>>,
  increments: ProgressionIncrements,
): { next: TrainingMaxes; changes: TrainingMaxChange[] } {
  const next: TrainingMaxes = { ...current };
  const changes: TrainingMaxChange[] = [];
  for (const { slot } of LIFT_SLOTS) {
    const tm = current[slot];
    if (tm === undefined) continue;
    const missed = outcomes[slot]?.missedReps ?? false;
    const to = missed ? Math.floor(resetTrainingMax(tm) / 5) * 5 : nextTrainingMax(tm, slot, increments);
    next[slot] = to;
    changes.push({ slot, from: tm, to, reason: missed ? "reset" : "progress" });
  }
  return { next, changes };
}

/** Lower every training max by a fraction (after a long break), rounded down to 5 lb. */
export function lowerTrainingMaxes(current: TrainingMaxes, fraction: number): TrainingMaxes {
  const out: TrainingMaxes = {};
  for (const [slot, tm] of Object.entries(current) as [LiftSlot, number][]) {
    out[slot] = Math.floor((tm * (1 - fraction)) / 5) * 5;
  }
  return out;
}
