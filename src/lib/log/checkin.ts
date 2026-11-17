import { z } from "zod";
import { FEELINGS, NOTES_MAX, type Feeling } from "./schema";

/**
 * Check-ins record how the person felt on a day without a workout: a rest
 * day, a missed training day or a skipped session. They use the same five
 * feelings as workouts so both can be shown together over time.
 */

export const CHECK_IN_TAGS = ["RESTED", "SORE", "TIRED", "STRESSED", "ACTIVE"] as const;
export type CheckInTag = (typeof CHECK_IN_TAGS)[number];

export const CHECK_IN_TAG_LABELS: Record<CheckInTag, string> = {
  RESTED: "Rested",
  SORE: "Sore",
  TIRED: "Tired",
  STRESSED: "Stressed",
  ACTIVE: "Active day",
};

/** Short names for the feelings, where the full workout wording doesn't fit. */
export const FEELING_SHORT: Record<Feeling, string> = {
  GREAT: "Great",
  GOOD: "Good",
  OKAY: "Okay",
  COULD_BE_BETTER: "Could be better",
  OFF_GAME: "Off",
};

export const checkInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  feeling: z.enum(FEELINGS).nullable(),
  tags: z.array(z.enum(CHECK_IN_TAGS)).max(CHECK_IN_TAGS.length),
  notes: z.string().max(NOTES_MAX, { error: `Notes can be up to ${NOTES_MAX} characters.` }),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

export type CheckIn = { date: string; feeling: Feeling | null; tags: CheckInTag[]; notes: string | null };

/** Stored JSON tags back to a clean list in the standard order (unknown tags dropped). */
export function parseTags(json: string | null | undefined): CheckInTag[] {
  try {
    const v: unknown = JSON.parse(json ?? "[]");
    if (!Array.isArray(v)) return [];
    return CHECK_IN_TAGS.filter((t) => v.includes(t));
  } catch {
    return [];
  }
}

/** Tags in the standard order, without repeats. */
export function normalizeTags(tags: readonly CheckInTag[]): CheckInTag[] {
  return CHECK_IN_TAGS.filter((t) => tags.includes(t));
}

/** True when nothing was filled in, so there's nothing worth keeping. */
export function isEmptyCheckIn(input: Pick<CheckInInput, "feeling" | "tags" | "notes">): boolean {
  return input.feeling === null && input.tags.length === 0 && input.notes.trim() === "";
}

export type DayKind = "rest" | "missed" | "skipped" | "trained" | "planned" | "future";

/**
 * What kind of day this is for a check-in. Only days up to today without a
 * finished workout (or a workout still planned for today) can have one.
 */
export function checkInDayKind(opts: {
  date: string;
  today: string;
  isTrainingDay: boolean;
  startDate: string | null;
  workouts: { status: "PLANNED" | "COMPLETED" | "SKIPPED" }[];
}): DayKind {
  const { date, today, workouts } = opts;
  if (date > today) return "future";
  if (workouts.some((w) => w.status === "COMPLETED")) return "trained";
  if (workouts.some((w) => w.status === "PLANNED")) return "planned";
  if (workouts.some((w) => w.status === "SKIPPED")) return "skipped";
  const inPlan = opts.startDate !== null && date >= opts.startDate;
  if (inPlan && opts.isTrainingDay && date < today) return "missed";
  return "rest";
}

export function canCheckIn(kind: DayKind): boolean {
  return kind === "rest" || kind === "missed" || kind === "skipped";
}
