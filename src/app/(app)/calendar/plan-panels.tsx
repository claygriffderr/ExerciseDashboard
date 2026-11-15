"use client";

import { useState, useTransition } from "react";
import type { GapOption } from "@/lib/training/schedule";
import type { LiftSlot } from "@/lib/training/five-three-one";
import { handleGapAction, startNextCycleAction, submitTestResultsAction } from "../plan-actions";

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 text-sm text-danger">
      {message}
    </p>
  );
}

/** "Welcome back" choices after two or more weeks away. */
export function GapAdvice({ message, options }: { message: string; options: GapOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choose = (action: GapOption["action"]) =>
    startTransition(async () => {
      const result = await handleGapAction(action);
      setError(result.ok ? null : result.error);
    });
  return (
    <section aria-labelledby="gap-title" className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
      <h2 id="gap-title" className="text-lg font-semibold text-ink">
        How would you like to restart?
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink">{message}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.action}
            type="button"
            disabled={pending}
            onClick={() => choose(o.action)}
            className={`rounded-xl border p-4 text-left transition disabled:opacity-60 ${
              o.recommended ? "border-accent bg-surface ring-1 ring-accent" : "border-line bg-surface hover:border-accent/50"
            }`}
          >
            <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              {o.label}
              {o.recommended && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-strong">Recommended</span>
              )}
            </span>
            <span className="mt-1 block text-sm leading-6 text-muted">{o.explanation}</span>
          </button>
        ))}
      </div>
      <ErrorText message={error} />
    </section>
  );
}

/** After the test sessions, for any lift that still has no training max. */
export function TestResultsForm({ lifts }: { lifts: { slot: LiftSlot; name: string; perHand: boolean }[] }) {
  const [values, setValues] = useState<Record<string, { weight: string; reps: string }>>(() =>
    Object.fromEntries(lifts.map((l) => [l.slot, { weight: "", reps: "5" }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sets: Record<string, { weight: number; reps: number }> = {};
    for (const l of lifts) {
      const weight = Number.parseFloat(values[l.slot].weight);
      const reps = Number.parseInt(values[l.slot].reps, 10);
      if (!(weight > 0) || !(reps > 0)) {
        setError(`Enter a weight and reps for the ${l.name.toLowerCase()}.`);
        return;
      }
      sets[l.slot] = { weight, reps };
    }
    startTransition(async () => {
      const result = await submitTestResultsAction(sets);
      setError(result.ok ? null : result.error);
    });
  };

  return (
    <section aria-labelledby="tests-title" className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
      <h2 id="tests-title" className="text-lg font-semibold text-ink">
        Enter your test results
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-ink">
        For each lift, enter the heaviest weight you lifted with good form, and how many reps you did, stopping with about 2
        reps left in the tank. Your training maxes and the first 5/3/1 cycle are worked out from these.
      </p>
      <form onSubmit={submit} className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {lifts.map((l) => (
            <fieldset key={l.slot} className="rounded-xl border border-line bg-surface p-3">
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
                    value={values[l.slot].weight}
                    onChange={(e) => setValues((v) => ({ ...v, [l.slot]: { ...v[l.slot], weight: e.target.value } }))}
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
                    value={values[l.slot].reps}
                    onChange={(e) => setValues((v) => ({ ...v, [l.slot]: { ...v[l.slot], reps: e.target.value } }))}
                    className={inputClass}
                  />
                </label>
              </div>
            </fieldset>
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong disabled:opacity-70"
        >
          {pending ? "Planning your first cycle…" : "Plan my first cycle"}
        </button>
        <ErrorText message={error} />
      </form>
    </section>
  );
}

/** Normally automatic; shown if the queue ever runs dry. */
export function StartCycleButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startNextCycleAction();
            setError(result.ok ? null : result.error);
          })
        }
        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong disabled:opacity-70"
      >
        {pending ? "Planning…" : "Plan the next cycle"}
      </button>
      <ErrorText message={error} />
    </div>
  );
}
