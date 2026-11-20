"use client";

import Link from "next/link";
import { useState, useTransition, type DragEvent } from "react";
import { formatShort, WEEKDAY_SHORT } from "@/lib/dates";
import type { CalendarDay, CalendarWorkout } from "@/lib/plan/calendar";
import { moveWorkoutAction, restoreUsualDaysAction } from "../plan-actions";

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0 fill-current">
      <path d="M9.8 1.5 14.5 6.2l-1.1 1.1-1-.3-2.4 2.4.4 2.6-1.1 1.1-2.6-2.6L3 14.2 1.8 13l3.7-3.7-2.6-2.6L4 5.6l2.6.4L9 3.6l-.3-1z" />
    </svg>
  );
}

function chipClass(w: CalendarWorkout): string {
  if (w.status === "COMPLETED") return "bg-success/15 text-success";
  if (w.status === "SKIPPED") return "bg-line/60 text-muted line-through";
  if (w.isNext) return "bg-accent text-accent-ink shadow-sm";
  return "border border-accent/40 bg-accent/5 text-ink";
}

function statusWord(w: CalendarWorkout): string {
  if (w.status === "COMPLETED") return "done";
  if (w.status === "SKIPPED") return "skipped";
  return w.isNext ? "next up" : "planned";
}

function WorkoutChip({
  w,
  onDragStart,
  onDragEnd,
  compact,
}: {
  w: CalendarWorkout;
  onDragStart?: (w: CalendarWorkout) => void;
  onDragEnd?: () => void;
  compact?: boolean;
}) {
  const draggable = w.status === "PLANNED" && !!onDragStart;
  return (
    <Link
      href={`/workouts/${w.id}`}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e: DragEvent) => {
              e.dataTransfer.setData("text/plain", w.id);
              e.dataTransfer.effectAllowed = "move";
              onDragStart!(w);
            }
          : undefined
      }
      onDragEnd={onDragEnd}
      aria-label={`${w.title}, ${statusWord(w)}${w.moved ? ", moved by you" : ""}`}
      className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium leading-tight hover:ring-2 hover:ring-accent/40 ${chipClass(
        w,
      )} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {w.status === "COMPLETED" && <span aria-hidden>✓</span>}
      <span className={compact ? "line-clamp-2" : ""}>{w.title}</span>
      {w.moved && <PinIcon />}
    </Link>
  );
}

function emptyDayLabel(day: CalendarDay): string {
  if (day.missed) return "Missed";
  if (day.dayOff) return "Day off · moved";
  return day.isTrainingDay ? "Training day" : "Rest day";
}

export function CalendarView({
  weeks,
  today,
  startDate,
  canRestore,
}: {
  weeks: CalendarDay[][];
  today: string;
  startDate: string;
  /** Some upcoming days were moved. */
  canRestore: boolean;
}) {
  const [dragging, setDragging] = useState<CalendarWorkout | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDrop = (day: CalendarDay) =>
    !!dragging &&
    day.date !== dragging.date &&
    day.date >= today &&
    day.date >= (dragging.earliestMove ?? today) &&
    !day.workouts.some((w) => w.status !== "PLANNED");

  const drop = (day: CalendarDay) => {
    const w = dragging;
    setDragging(null);
    setOver(null);
    if (!w || !canDrop(day)) return;
    setError(null);
    startTransition(async () => {
      const result = await moveWorkoutAction(w.id, day.date);
      if (!result.ok) setError(result.error);
    });
  };

  const restore = () => {
    setError(null);
    startTransition(async () => {
      const result = await restoreUsualDaysAction();
      if (!result.ok) setError(result.error);
    });
  };

  const days = weeks.flat();
  const agenda = days.filter(
    (d) => d.inMonth && (d.workouts.length > 0 || d.isToday || d.dayOff || (d.isTrainingDay && d.date >= startDate)),
  );

  return (
    <div>
      <p className="mb-3 hidden text-sm text-muted sm:block" aria-live="polite">
        {dragging
          ? `Drop ${dragging.title} on a highlighted day. Its old day becomes a day off, and workouts keep their order.`
          : "Drag a planned workout to another day to move it, or click it to open."}
      </p>
      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Month grid, tablet and up */}
      <div
        className={`hidden overflow-hidden rounded-2xl border border-line bg-surface sm:block ${pending ? "opacity-60" : ""}`}
        aria-busy={pending}
      >
        <div className="grid grid-cols-7 border-b border-line bg-background/60 text-center text-xs font-semibold uppercase tracking-wide text-muted">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const droppable = canDrop(day);
            return (
              <div
                key={day.date}
                onDragOver={(e) => {
                  if (!droppable) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== day.date) setOver(day.date);
                }}
                onDragLeave={() => over === day.date && setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(day);
                }}
                className={`min-h-28 border-b border-r border-line p-1.5 transition-colors [&:nth-child(7n)]:border-r-0 ${
                  day.inMonth ? "" : "bg-background/50"
                } ${droppable ? "bg-accent/10" : ""} ${over === day.date ? "ring-2 ring-inset ring-accent" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${
                      day.isToday ? "bg-accent text-accent-ink" : day.inMonth ? "text-ink" : "text-muted/60"
                    }`}
                  >
                    <span aria-hidden>{Number(day.date.slice(8))}</span>
                    <span className="sr-only">{formatShort(day.date)}</span>
                  </span>
                  {day.missed && <span className="text-[11px] font-medium text-danger/80">Missed</span>}
                </div>
                <div className="space-y-1">
                  {day.workouts.map((w) => (
                    <WorkoutChip
                      key={w.id}
                      w={w}
                      compact
                      onDragStart={setDragging}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                    />
                  ))}
                  {day.workouts.length === 0 && !day.missed && day.inMonth && day.date >= startDate && (
                    <span className="flex items-center gap-1 px-1 text-[11px] text-muted/80">
                      {day.dayOff ? "Day off · moved" : day.isTrainingDay ? "Training day" : "Rest"}
                      {day.dayOff && <PinIcon />}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda list, phones */}
      <ol className="space-y-2 sm:hidden" aria-label="Training days this month">
        {agenda.length === 0 && <li className="text-sm text-muted">No training days this month.</li>}
        {agenda.map((day) => (
          <li
            key={day.date}
            className={`flex gap-3 rounded-xl border bg-surface p-3 ${day.isToday ? "border-accent" : "border-line"}`}
          >
            <div className="w-16 shrink-0">
              <div className={`text-xs font-semibold uppercase ${day.isToday ? "text-accent" : "text-muted"}`}>
                {day.isToday ? "Today" : WEEKDAY_SHORT[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}
              </div>
              <div className="text-lg font-semibold tabular-nums text-ink">{Number(day.date.slice(8))}</div>
            </div>
            <div className="flex-1 space-y-1.5 self-center">
              {day.workouts.map((w) => (
                <WorkoutChip key={w.id} w={w} />
              ))}
              {day.workouts.length === 0 && (
                <span className={`flex items-center gap-1.5 text-sm ${day.missed ? "text-danger/80" : "text-muted"}`}>
                  {emptyDayLabel(day)}
                  {day.dayOff && !day.missed && <PinIcon />}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-accent" /> Next workout
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-accent/40 bg-accent/5" /> Planned
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-success/30" /> Done
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-line" /> Skipped
        </li>
        <li className="flex items-center gap-1.5">
          <PinIcon /> Moved by you
        </li>
      </ul>
      {canRestore && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">You moved some upcoming days.</span>
          <button
            type="button"
            disabled={pending}
            onClick={restore}
            className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink hover:bg-line/40 disabled:opacity-60"
          >
            Restore my usual days
          </button>
        </div>
      )}
    </div>
  );
}
