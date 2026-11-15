/**
 * Plate math. Works in quarter-pound units internally so values like 2.5 and
 * 1.25 never produce floating-point drift.
 */

export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];
export const ALL_PLATE_SIZES = [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25];

export const BAR_OPTIONS = [
  { weight: 45, label: "Standard barbell (45 lb)" },
  { weight: 35, label: "Women's / lighter barbell (35 lb)" },
  { weight: 25, label: "Short or curl bar (25 lb)" },
  { weight: 15, label: "Technique bar (15 lb)" },
];

const SCALE = 4;
const toUnits = (lb: number) => Math.round(lb * SCALE);
const fromUnits = (u: number) => u / SCALE;

function normalizePlates(plates: number[]): number[] {
  return [...new Set(plates.filter((p) => Number.isFinite(p) && p > 0))].sort((a, b) => b - a);
}

/**
 * Fewest plates (per side) that add up to exactly `perSide`, or null if the
 * plates can't make that amount. Unlimited pairs of each size are assumed.
 */
export function platesForSide(perSide: number, plates: number[]): number[] | null {
  const sizes = normalizePlates(plates).map(toUnits);
  const target = toUnits(perSide);
  if (target < 0) return null;
  if (target === 0) return [];
  // Minimum-coin dynamic programming.
  const best = new Array<number>(target + 1).fill(Infinity);
  const pick = new Array<number>(target + 1).fill(-1);
  best[0] = 0;
  for (let t = 1; t <= target; t++) {
    for (const s of sizes) {
      if (s <= t && best[t - s] + 1 < best[t]) {
        best[t] = best[t - s] + 1;
        pick[t] = s;
      }
    }
  }
  if (!Number.isFinite(best[target])) return null;
  const out: number[] = [];
  for (let t = target; t > 0; t -= pick[t]) out.push(fromUnits(pick[t]));
  return out.sort((a, b) => b - a);
}

export type LoadOption = {
  /** Total weight on the bar, including the bar. */
  total: number;
  /** Plates for one side, heaviest first. */
  perSide: number[];
  /** total - target (negative means lighter than the target). */
  diff: number;
  /** diff as a fraction of the target. */
  diffPct: number;
};

/**
 * Every load you can build within ±tolerance of the target, closest first.
 * Always includes the nearest load on each side of the target so there is
 * something to show even with a tight tolerance.
 */
export function loadOptions(
  target: number,
  barWeight: number,
  plates: number[],
  tolerance = 0.05,
  maxOptions = 8,
): LoadOption[] {
  if (!(target > 0)) return [];
  const sizes = normalizePlates(plates);
  const smallestPair = sizes.length ? sizes[sizes.length - 1] * 2 : 0;
  const lo = Math.max(barWeight, target * (1 - tolerance));
  const hi = Math.max(barWeight, target * (1 + tolerance));

  // Every buildable total is the bar plus a multiple of the finest step the
  // plates allow; scan totals from just under `lo` to just over `hi`.
  const step = smallestPair > 0 ? gcdStep(sizes) * 2 : 1;
  const results: LoadOption[] = [];
  const seen = new Set<number>();
  const consider = (total: number) => {
    const key = toUnits(total);
    if (seen.has(key) || total < barWeight) return;
    const perSide = platesForSide((total - barWeight) / 2, sizes);
    if (!perSide) return;
    seen.add(key);
    const diff = round2(total - target);
    results.push({ total: round2(total), perSide, diff, diffPct: diff / target });
  };

  if (step > 0 && sizes.length) {
    const startK = Math.floor((lo - barWeight) / step) - 1;
    const endK = Math.ceil((hi - barWeight) / step) + 1;
    for (let k = Math.max(0, startK); k <= endK; k++) consider(barWeight + k * step);
  }
  consider(barWeight);

  const below = results.filter((r) => r.total <= target).sort((a, b) => b.total - a.total)[0];
  const above = results.filter((r) => r.total >= target).sort((a, b) => a.total - b.total)[0];
  const inRange = results.filter((r) => Math.abs(r.diffPct) <= tolerance + 1e-9);
  const chosen = new Map<number, LoadOption>();
  for (const r of [...inRange, below, above]) if (r) chosen.set(toUnits(r.total), r);

  return [...chosen.values()]
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || a.total - b.total)
    .slice(0, maxOptions);
}

/**
 * The buildable load closest to the target (ties go to the lighter load,
 * which is the safer choice). Returns the bar weight if the target is lighter.
 */
export function nearestBarbellLoad(target: number, barWeight: number, plates: number[]): number {
  if (!(target > barWeight)) return barWeight;
  const [best] = loadOptions(target, barWeight, plates, 0, 2);
  return best ? best.total : roundToIncrement(target, 5);
}

/** Round to the nearest multiple of `increment` (ties round down). */
export function roundToIncrement(value: number, increment: number): number {
  if (!(increment > 0)) return round2(value);
  const units = value / increment;
  const floor = Math.floor(units);
  const rounded = units - floor > 0.5 + 1e-9 ? floor + 1 : floor;
  return round2(rounded * increment);
}

function gcdStep(sizes: number[]): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return fromUnits(sizes.map(toUnits).reduce((a, b) => gcd(a, b)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
