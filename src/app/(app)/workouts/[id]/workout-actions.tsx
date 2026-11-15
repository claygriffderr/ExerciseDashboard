"use client";

import { useState, useTransition } from "react";
import { formatShort } from "@/lib/dates";
import type { LiftSlot } from "@/lib/training/five-three-one";
import type { ActionResult } from "@/lib/plan/workouts";
import {
  completeWorkoutAction,
  moveWorkoutAction,
  skipWorkoutAction,
  undoWorkoutAction,
  unpinWorkoutAction,
} from "../../plan-actions";

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const primary =
  "rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70";
const secondary = "rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-line/40 disabled:opacity-60";

export type TestLift = { slot: LiftSlot; name: string; perHand: boolean };

export type WorkoutActionsProps = {
  workoutId: string;
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  isNext: boolean;
  canUndo: boolean;
  today: string;
  earliestDone: string | null;
  projectedDate: string | null;
  earliestMove: string | null;
  pinned: boolean;
  previous: { title: string; date: string } | null;
  testLifts: TestLift[];
};

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : result.error);
    });
  return { error, pending, run };
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 text-sm text-danger">
      {message}
    </p>
  );
}

export function WorkoutActions(props: WorkoutActionsProps) {
  if (props.status !== "PLANNED") return props.canUndo ? <UndoCard {...props} /> : null;
  return (
    <div className="space-y-4">
      {props.isNext ? (
        <FinishCard {...props} />
      ) : (
        props.previous && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-6 text-muted">
            This comes after <span className="font-medium text-ink">{props.previous.title}</span> (
            {formatShort(props.previous.date)}). Workouts are done in order, so finish or skip that one first.
          </div>
        )
      )}
      <MoveCard {...props} />
    </div>
  );
}

function FinishCard({ workoutId, today, earliestDone, testLifts }: WorkoutActionsProps) {
  const [date, setDate] = useState(today);
  const [tests, setTests] = useState<Record<string, { weight: string; reps: string }>>(() =>
    Object.fromEntries(testLifts.map((l) => [l.slot, { weight: "", reps: "5" }])),
  );
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { error, pending, run } = useAction();
  const [localError, setLocalError] = useState<string | null>(null);

  const finish = (e: React.FormEvent) => {
    e.preventDefault();
    const testSets: Record<string, { weight: number; reps: number }> = {};
    for (const l of testLifts) {
      const weight = Number.parseFloat(tests[l.slot].weight);
      const reps = Number.parseInt(tests[l.slot].reps, 10);
      if (!(weight > 0) || !(reps > 0)) {
        setLocalError(`Enter the weight and reps of your test set for the ${l.name.toLowerCase()}.`);
        return;
      }
      testSets[l.slot] = { weight, reps };
    }
    setLocalError(null);
    run(() => completeWorkoutAction(workoutId, { date, testSets: testLifts.length ? testSets : undefined }));
  };

  return (
    <section aria-labelledby="finish-title" className="rounded-2xl border border-accent/40 bg-surface p-5">
      <h2 id="finish-title" className="text-lg font-semibold text-ink">
        Finished this workout?
      </h2>
      <form onSubmit={finish} className="mt-3">
        {testLifts.length > 0 && (
          <div className="mb-4">
            <p className="text-sm leading-6 text-muted">
              Enter your test set for each lift: the heaviest weight you lifted for about 5 reps with roughly 2 left in the
              tank. Your training maxes are worked out from these.
            </p>
            <div className="mt-3 grid gap-3">
              {testLifts.map((l) => (
                <fieldset key={l.slot} className="rounded-xl border border-line p-3">
                  <legend className="px-1 text-sm font-semibold text-ink">{l.name}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-muted">Weight (lb{l.perHand ? ", per hand" : ""})</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        required
                        value={tests[l.slot].weight}
                        onChange={(e) => setTests((t) => ({ ...t, [l.slot]: { ...t[l.slot], weight: e.target.value } }))}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-muted">Reps</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={15}
                        required
                        value={tests[l.slot].reps}
                        onChange={(e) => setTests((t) => ({ ...t, [l.slot]: { ...t[l.slot], reps: e.target.value } }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-muted">Day you did it</span>
            <input
              type="date"
              value={date}
              max={today}
              min={earliestDone ?? undefined}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={pending} className={primary}>
            {pending ? "Saving…" : "Mark as done"}
          </button>
        </div>
      </form>
      <ErrorText message={localError ?? error} />

      <div className="mt-5 border-t border-line pt-4">
        {confirmSkip ? (
          <div>
            <p className="text-sm leading-6 text-ink">
              Skip it? It won&apos;t be made up: the next workout takes its place on your next training day.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => skipWorkoutAction(workoutId))} className={secondary}>
                Yes, skip it
              </button>
              <button type="button" onClick={() => setConfirmSkip(false)} className={secondary}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmSkip(true)} className="text-sm font-medium text-muted hover:text-ink">
            Skip this workout…
          </button>
        )}
      </div>
    </section>
  );
}

function MoveCard({ workoutId, today, projectedDate, earliestMove, pinned }: WorkoutActionsProps) {
  const min = earliestMove && earliestMove > today ? earliestMove : today;
  const [date, setDate] = useState(projectedDate ?? min);
  const { error, pending, run } = useAction();
  return (
    <section aria-labelledby="move-title" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="move-title" className="text-lg font-semibold text-ink">
        Move to another day
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Pick any free day, including a rest day to catch up. Workouts stay in order, so later workouts follow along if
        needed. You can also drag workouts on the calendar.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="text-muted">New day</span>
          <input type="date" value={date} min={min} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <button
          type="button"
          disabled={pending || !date || date === projectedDate}
          onClick={() => run(() => moveWorkoutAction(workoutId, date))}
          className={secondary}
        >
          {pending ? "Moving…" : "Move"}
        </button>
        {pinned && (
          <button type="button" disabled={pending} onClick={() => run(() => unpinWorkoutAction(workoutId))} className={secondary}>
            Back to its usual day
          </button>
        )}
      </div>
      <ErrorText message={error} />
    </section>
  );
}

function UndoCard({ workoutId, status }: WorkoutActionsProps) {
  const { error, pending, run } = useAction();
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm leading-6 text-muted">
        {status === "COMPLETED" ? "Marked as done by mistake?" : "Skipped by mistake?"} Undo it and this becomes your next
        workout again.
      </p>
      <button type="button" disabled={pending} onClick={() => run(() => undoWorkoutAction(workoutId))} className={`mt-3 ${secondary}`}>
        {pending ? "Undoing…" : status === "COMPLETED" ? "Mark as not done" : "Undo skip"}
      </button>
      <ErrorText message={error} />
    </section>
  );
}
