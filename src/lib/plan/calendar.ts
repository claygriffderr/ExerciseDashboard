import { addDays, parseDate, projectSchedule, weekday, type DateStr } from "../training/schedule";

export type QueuedWorkout = { id: string; title: string; pinnedDate: string | null; phase: string | null; weekNumber: number | null };
export type PerformedWorkout = {
  id: string;
  title: string;
  status: "COMPLETED" | "SKIPPED";
  performedDate: string;
  phase: string | null;
  weekNumber: number | null;
};

export type CalendarWorkout = {
  id: string;
  title: string;
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  date: DateStr;
  pinned: boolean;
  phase: string | null;
  weekNumber: number | null;
  /** The next workout in the queue. */
  isNext: boolean;
  /** Earliest date this planned workout may move to (keeps the queue in order). */
  earliestMove?: DateStr;
};

export type CalendarDay = {
  date: DateStr;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isTrainingDay: boolean;
  /** A past training day with nothing done. */
  missed: boolean;
  workouts: CalendarWorkout[];
};

export type CalendarData = {
  queue: QueuedWorkout[];
  performed: PerformedWorkout[];
  trainingWeekdays: number[];
  today: DateStr;
  startDate: DateStr;
};

/** Planned workouts with their projected dates, in queue order. */
export function projectQueue(data: CalendarData): CalendarWorkout[] {
  const busy = data.performed.map((p) => p.performedDate);
  const from = data.startDate > data.today ? data.startDate : data.today;
  const dates = projectSchedule(
    data.queue.map((q) => ({ id: q.id, pinnedDate: q.pinnedDate })),
    { trainingWeekdays: data.trainingWeekdays, today: from, busyDates: busy },
  );
  let previous: DateStr | null = null;
  return data.queue.flatMap((q, i) => {
    const date = dates.get(q.id);
    if (!date) return [];
    const earliestMove = previous ? addDays(previous, 1) : from;
    previous = date;
    return [
      {
        id: q.id,
        title: q.title,
        status: "PLANNED" as const,
        date,
        pinned: !!q.pinnedDate && q.pinnedDate === date,
        phase: q.phase,
        weekNumber: q.weekNumber,
        isNext: i === 0,
        earliestMove,
      },
    ];
  });
}

/** "YYYY-MM" for a date. */
export function monthOf(d: DateStr): string {
  return d.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Sunday-first weeks covering the month, each day with its workouts. */
export function buildMonth(month: string, data: CalendarData, projected = projectQueue(data)): CalendarDay[][] {
  const first = `${month}-01`;
  const start = addDays(first, -weekday(first));
  const lastOfMonth = (() => {
    const d = parseDate(first);
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  })();
  const end = addDays(lastOfMonth, 6 - weekday(lastOfMonth));

  const byDate = new Map<DateStr, CalendarWorkout[]>();
  const push = (w: CalendarWorkout) => byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  for (const p of data.performed) {
    push({
      id: p.id,
      title: p.title,
      status: p.status,
      date: p.performedDate,
      pinned: false,
      phase: p.phase,
      weekNumber: p.weekNumber,
      isNext: false,
    });
  }
  for (const w of projected) push(w);

  const training = new Set(data.trainingWeekdays);
  const weeks: CalendarDay[][] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (weekday(day) === 0) weeks.push([]);
    const workouts = byDate.get(day) ?? [];
    const isPast = day < data.today;
    const isTrainingDay = training.has(weekday(day));
    weeks[weeks.length - 1].push({
      date: day,
      inMonth: day.slice(0, 7) === month,
      isToday: day === data.today,
      isPast,
      isTrainingDay,
      missed: isPast && isTrainingDay && day >= data.startDate && workouts.length === 0,
      workouts,
    });
  }
  return weeks;
}

/** The most recent day a workout was done (skips don't count as training). */
export function lastTrainedDate(performed: PerformedWorkout[]): DateStr | null {
  const done = performed.filter((p) => p.status === "COMPLETED").map((p) => p.performedDate);
  return done.length ? done.sort().at(-1)! : null;
}
