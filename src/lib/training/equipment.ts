import { nearestBarbellLoad, roundToIncrement } from "./plates";

export type Equipment = "barbell" | "dumbbell" | "kettlebell" | "machine" | "cable" | "bodyweight";

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbells",
  kettlebell: "Kettlebell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
};

/** What the person has to load weights with. */
export type Gear = {
  barWeight: number;
  plates: number[];
  /** Jump between dumbbell sizes. */
  dumbbellStep: number;
  /** Kettlebell sizes on hand, in lb. */
  kettlebells: number[];
  /** Jump between machine or cable stack settings. */
  stackStep: number;
};

export const DEFAULT_GEAR: Gear = {
  barWeight: 45,
  plates: [45, 35, 25, 10, 5, 2.5],
  dumbbellStep: 5,
  // Common sizes: 8, 12, 16, 20, 24 and 32 kg, in lb.
  kettlebells: [18, 26, 35, 44, 53, 70],
  stackStep: 5,
};

/** Turn a calculated weight into one the person can actually load. */
export function loadableWeight(target: number, equipment: Equipment, gear: Gear = DEFAULT_GEAR): number | null {
  if (!(target > 0)) return null;
  switch (equipment) {
    case "barbell":
      return nearestBarbellLoad(target, gear.barWeight, gear.plates);
    case "dumbbell":
      return Math.max(gear.dumbbellStep, roundToIncrement(target, gear.dumbbellStep));
    case "kettlebell":
      return nearestSize(target, gear.kettlebells);
    case "machine":
    case "cable":
      return Math.max(gear.stackStep, roundToIncrement(target, gear.stackStep));
    case "bodyweight":
      return null;
  }
}

/** Closest size from a list (ties go to the lighter one). */
function nearestSize(target: number, sizes: number[]): number | null {
  if (sizes.length === 0) return null;
  return [...sizes].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0];
}
