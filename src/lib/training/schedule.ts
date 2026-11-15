/**
 * Scheduling: the program is an ordered queue of workouts, and the calendar is
 * a set of training days. A missed workout never gets dropped and the
 * training days never move. The missed session simply becomes the next one
 * on the next training day, so every lift keeps moving through its weeks in
 * order.
 *
 * Dates are "YYYY-MM-DD" strings for calendar days (no times, no time zones).
 */

export type DateStr = string;

export type QueueItem = {
  id: string;
  /** A day the person chose for this workout (for example, a make-up on a rest day). */
  pinnedDate?: DateStr | null;
};

export type ScheduleOptions = {
  /** Weekdays the person trains on, 0 = Sunday ... 6 = Saturday. */
  trainingWeekdays: number[];
  /** The person's current local date. */
  today: DateStr;
  /** Days that already have a finished or skipped workout. Nothing else goes there. */
  busyDates?: DateStr[];
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

/**
 * Projected date for every planned workout, in queue order. Rules:
 * - A pinned workout keeps its date if that date is today or later and comes
 *   after the workout before it in the queue. Otherwise the pin is ignored
 *   (it was missed, or it would put sessions out of order).
 * - Every other workout takes the next free training day after the one before it.
 * - One workout per day.
 */
export function projectSchedule(items: QueueItem[], opts: ScheduleOptions): Map<string, DateStr> {
  const weekdays = new Set(opts.trainingWeekdays.filter((d) => d >= 0 && d <= 6));
  const horizon = opts.horizonDays ?? 3650;
  const occupied = new Set(opts.busyDates ?? []);
  for (const item of items) {
    if (item.pinnedDate && item.pinnedDate >= opts.today) occupied.add(item.pinnedDate);
  }

  const result = new Map<string, DateStr>();
  let cursor = opts.today;
  for (const item of items) {
    const pin = item.pinnedDate;
    if (pin && pin >= cursor) {
      result.set(item.id, pin);
      cursor = addDays(pin, 1);
      continue;
    }
    if (pin) occupied.delete(pin);
    if (weekdays.size === 0) break;
    let day = cursor;
    let guard = 0;
    while ((!weekdays.has(weekday(day)) || occupied.has(day)) && guard++ < horizon) day = addDays(day, 1);
    if (guard >= horizon) break;
    result.set(item.id, day);
    occupied.add(day);
    cursor = addDays(day, 1);
  }
  return result;
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
