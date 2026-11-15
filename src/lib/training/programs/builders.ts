import { loadableWeight, type Gear } from "../equipment";
import { getExercise } from "../exercises";
import { WARMUP_SETS, workSets, type LiftSlot, type SetScheme, type WaveStyle } from "../five-three-one";
import type { PlannedExercise, PlannedSet, Section, TrainingMaxes } from "./types";

/** Weight for a percentage of the training max, rounded to what can be loaded. */
export function weightFor(percent: number, tm: number | undefined, exerciseSlug: string, gear: Gear): number | null {
  if (!tm) return null;
  return loadableWeight(tm * percent, getExercise(exerciseSlug).equipment, gear);
}

function percentSets(schemes: SetScheme[], tm: number | undefined, slug: string, gear: Gear): PlannedSet[] {
  return schemes.map((s) => ({
    reps: s.reps,
    percent: s.percent,
    weight: weightFor(s.percent, tm, slug, gear),
    ...(s.amrap ? { amrap: true } : {}),
  }));
}

/** Warm-up plus the week's three work sets for one main lift. */
export function mainLiftBlocks(opts: {
  slot: LiftSlot;
  exerciseSlug: string;
  week: 1 | 2 | 3 | 4;
  style: WaveStyle;
  tms: TrainingMaxes;
  gear: Gear;
  warmup?: boolean;
}): PlannedExercise[] {
  const tm = opts.tms[opts.slot];
  const blocks: PlannedExercise[] = [];
  if (opts.warmup !== false) {
    blocks.push({
      exerciseSlug: opts.exerciseSlug,
      section: "WARMUP",
      slot: opts.slot,
      sets: percentSets(WARMUP_SETS, tm, opts.exerciseSlug, opts.gear),
    });
  }
  blocks.push({
    exerciseSlug: opts.exerciseSlug,
    section: "MAIN",
    slot: opts.slot,
    sets: percentSets(workSets(opts.week, opts.style), tm, opts.exerciseSlug, opts.gear),
  });
  return blocks;
}

/** Repeated sets at one percentage (Boring But Big, First Set Last). */
export function volumeSets(opts: {
  slot: LiftSlot;
  exerciseSlug: string;
  percent: number;
  sets: number;
  reps: number;
  tms: TrainingMaxes;
  gear: Gear;
  note?: string;
}): PlannedExercise {
  const weight = weightFor(opts.percent, opts.tms[opts.slot], opts.exerciseSlug, opts.gear);
  return {
    exerciseSlug: opts.exerciseSlug,
    section: "SUPPLEMENTAL",
    slot: opts.slot,
    sets: Array.from({ length: opts.sets }, () => ({ reps: opts.reps, percent: opts.percent, weight })),
    ...(opts.note ? { note: opts.note } : {}),
  };
}

/** Sets where the person chooses the weight. */
export function selfLoadedSets(
  exerciseSlug: string,
  section: Section,
  sets: number,
  reps: number,
  extra: Partial<PlannedSet> & { note?: string; slot?: LiftSlot } = {},
): PlannedExercise {
  const { note, slot, ...setExtra } = extra;
  return {
    exerciseSlug,
    section,
    ...(slot ? { slot } : {}),
    sets: Array.from({ length: sets }, () => ({ reps, weight: null, ...setExtra })),
    ...(note ? { note } : {}),
  };
}
