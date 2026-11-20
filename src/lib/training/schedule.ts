/**
 * Scheduling: the program is an ordered queue of workouts, and the calendar is
 * a set of training days. A missed workout never gets dropped: it simply
 * becomes the next one on the next training day, so every lift keeps moving
 * through its weeks in order. Moving a workout changes which days are
 * training days, never the order of the workouts.
 *
 * Dates are "YYYY-MM-DD" strings for calendar days (no times, no time zones).
 */

export type DateStr = string;

/**
 * Days the person changed by moving workouts. "OFF" takes a usual training
 * day out of the schedule; "EXTRA" adds a day that isn't one.
 */
export type DayChangeKind = "EXTRA" | "OFF";
export type DayChanges = ReadonlyMap<DateStr, DayChangeKind>;

export type ScheduleOptions = {
  /** Weekdays the person trains on, 0 = Sunday ... 6 = Saturday. */
  trainingWeekdays: number[];
  /** The first day workouts can go on (the person's current local date, or a later start date). */
  today: DateStr;
  /** Days that already have a finished or skipped workout. Nothing else goes there. */
  busyDates?: DateStr[];
  /** Days moved in or out of the schedule. */
  dayChanges?: DayChanges;
  /** Safety limit on how far ahead to look. */
  horizonDays?: number;
};

export function parseDate(d: DateStr): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function formatDate(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: DateStr, n: number): DateStr {
  const date = parseDate(d);
  date.setUTCDate(date.getUTCDate() + n);
  return formatDate(date);
}

export function weekday(d: DateStr): number {
  return parseDate(d).getUTCDay();
}

export function daysBetween(from: DateStr, to: DateStr): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

/** Whether a day is in the schedule, counting days the person moved. */
export function isTrainingDate(d: DateStr, trainingWeekdays: Iterable<number>, changes?: DayChanges): boolean {
  const change = changes?.get(d);
  if (change === "EXTRA") return true;
  if (change === "OFF") return false;
  return new Set(trainingWeekdays).has(weekday(d));
}

/**
 * Projected date for every planned workout, in queue order. The order of
 * workouts never changes: they fill the training days (usual weekdays, minus
 * days moved off, plus days moved to) one per day, skipping days that
 * already have a finished or skipped workout.
 */
export function projectSchedule(ids: string[], opts: ScheduleOptions): Map<string, DateStr> {
  const weekdays = new Set(opts.trainingWeekdays.filter((d) => d >= 0 && d <= 6));
  const changes = opts.dayChanges ?? new Map<DateStr, DayChangeKind>();
  const horizon = opts.horizonDays ?? 3650;
  const busy = new Set(opts.busyDates ?? []);
  const lastExtra = [...changes].filter(([, k]) => k === "EXTRA").map(([d]) => d).sort().at(-1);

  const result = new Map<string, DateStr>();
  let day = opts.today;
  for (const id of ids) {
    let guard = 0;
    while (!(isTrainingDate(day, weekdays, changes) && !busy.has(day))) {
      // With no usual training days, only added days can be used.
      if (++guard > horizon || (weekdays.size === 0 && (!lastExtra || day > lastExtra))) return result;
      day = addDays(day, 1);
    }
    result.set(id, day);
    day = addDays(day, 1);
  }
  return result;
}

/**
 * The day changes after moving the workout on `from` to `to`. The order of
 * workouts stays the same: `from` leaves the schedule and `to` joins it, and
 * the queue fills the resulting days in order. Moving onto a day that's
 * already a training day only takes `from` out.
 */
export function moveDay(changes: DayChanges, from: DateStr, to: DateStr, trainingWeekdays: number[]): Map<DateStr, DayChangeKind> {
  const next = new Map(changes);
  if (from === to) return next;
  const usual = (d: DateStr) => trainingWeekdays.includes(weekday(d));
  if (next.get(from) === "EXTRA") next.delete(from);
  else if (usual(from)) next.set(from, "OFF");
  if (next.get(to) === "OFF") next.delete(to);
  else if (!usual(to)) next.set(to, "EXTRA");
  return next;
}

/** The next `count` training days on or after `from`. */
export function nextTrainingDays(from: DateStr, trainingWeekdays: number[], count: number): DateStr[] {
  const weekdays = new Set(trainingWeekdays);
  const out: DateStr[] = [];
  if (weekdays.size === 0) return out;
  for (let day = from; out.length < count; day = addDays(day, 1)) {
    if (weekdays.has(weekday(day))) out.push(day);
  }
  return out;
}

/** Suggested training days for a given number of sessions per week. */
export const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  2: [1, 4], // Mon, Thu
  3: [1, 3, 5], // Mon, Wed, Fri
  4: [1, 2, 4, 5], // Mon, Tue, Thu, Fri
};

export type GapAdvice =
  | { kind: "none"; daysAway: number }
  | { kind: "ease-back"; daysAway: number; message: string; options: GapOption[] }
  | { kind: "reset"; daysAway: number; message: string; options: GapOption[] };

export type GapOption = {
  action: "continue" | "repeat-week" | "lower-training-max";
  label: string;
  explanation: string;
  /** For lower-training-max: the fraction to take off. */
  reduceBy?: number;
  recommended?: boolean;
};

/**
 * What to do after time away. Short breaks need nothing. After about two
 * weeks, ease back in. After about a month, lower the training maxes, which
 * is the standard 5/3/1 response to a layoff.
 */
export function adviseAfterGap(lastTrainedDate: DateStr | null, today: DateStr): GapAdvice {
  if (!lastTrainedDate) return { kind: "none", daysAway: 0 };
  const daysAway = daysBetween(lastTrainedDate, today);
  if (daysAway < 14) return { kind: "none", daysAway };
  if (daysAway < 28) {
    return {
      kind: "ease-back",
      daysAway,
      message: `Welcome back! It's been ${daysAway} days since your last workout. Ease back in before picking up where you left off.`,
      options: [
        {
          action: "repeat-week",
          label: "Repeat your last week",
          explanation: "Redo the last week you finished. Familiar weights help you find your groove again.",
          recommended: true,
        },
        {
          action: "lower-training-max",
          label: "Lower weights by 5%",
          explanation: "Take 5% off every training max and continue from where you are.",
          reduceBy: 0.05,
        },
        { action: "continue", label: "Carry on", explanation: "Continue as planned. Fine if you stayed active while away." },
      ],
    };
  }
  return {
    kind: "reset",
    daysAway,
    message: `Welcome back! It's been ${daysAway} days. After a month or more away, starting a bit lighter lets you rebuild quickly without getting hurt.`,
    options: [
      {
        action: "lower-training-max",
        label: "Lower weights by 10%",
        explanation: "Take 10% off every training max. You'll be back to where you were within a few cycles.",
        reduceBy: 0.1,
        recommended: true,
      },
      {
        action: "repeat-week",
        label: "Repeat your last week",
        explanation: "Redo the last week you finished at the same weights.",
      },
    ],
  };
}
