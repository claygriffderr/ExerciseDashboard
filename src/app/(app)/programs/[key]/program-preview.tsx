"use client";

import { useMemo, useState } from "react";
import { WorkoutCard } from "@/components/workout-card";
import type { Gear } from "@/lib/training/equipment";
import { getExercise, weightIsPerHand } from "@/lib/training/exercises";
import { LIFT_SLOTS, WAVE, trainingMaxFromOneRepMax, type LiftSlot } from "@/lib/training/five-three-one";
import { getProgram } from "@/lib/training/programs";
import type { PlannedWorkout, TrainingMaxes } from "@/lib/training/programs/types";

const SAMPLE_MAXES: Record<string, Record<LiftSlot, string>> = {
  "standard": { squat: "225", bench: "185", deadlift: "275", press: "115" },
  "beginner-onramp": { squat: "60", bench: "30", deadlift: "70", press: "20" },
};

export function ProgramPreview({ programKey, gear }: { programKey: string; gear: Gear }) {
  const program = getProgram(programKey)!;
  const settings = program.defaultSettings;
  const [maxes, setMaxes] = useState<Record<LiftSlot, string>>(SAMPLE_MAXES[programKey] ?? SAMPLE_MAXES["standard"]);

  const trainingMaxes: TrainingMaxes = useMemo(() => {
    const out: TrainingMaxes = {};
    for (const { slot } of LIFT_SLOTS) {
      const n = Number.parseFloat(maxes[slot]);
      if (n > 0) out[slot] = trainingMaxFromOneRepMax(n, settings.trainingMaxPercent);
    }
    return out;
  }, [maxes, settings.trainingMaxPercent]);

  const intro = useMemo(() => program.buildIntro({ settings, gear }), [program, settings, gear]);
  const cycle = useMemo(
    () => program.buildCycle({ settings, trainingMaxes, gear, cycle: 1 }),
    [program, settings, trainingMaxes, gear],
  );

  const tabs: { key: string; label: string; workouts: PlannedWorkout[] }[] = [];
  if (intro.length) {
    for (const phase of program.phases.filter((p) => p.key !== "main")) {
      const workouts = intro.filter((w) => w.phase === phase.key);
      // Practice sessions repeat, so one week shows the pattern.
      const shown = phase.key === "learn" ? workouts.filter((w) => w.week === 1) : workouts;
      if (shown.length) tabs.push({ key: phase.key, label: phase.name, workouts: shown });
    }
  }
  const weeks = [...new Set(cycle.map((w) => w.week))];
  for (const week of weeks) {
    tabs.push({ key: `w${week}`, label: WAVE[week as 1 | 2 | 3 | 4].name, workouts: cycle.filter((w) => w.week === week) });
  }
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const isBeginner = program.key === "beginner-onramp";

  return (
    <div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">
          {isBeginner
            ? "Enter rough one-rep max estimates to preview the 5/3/1 phase. In the real program you don't need these: the test sessions work them out for you."
            : "Enter your one-rep max (or a recent best estimate) for each lift. Weights are rounded to the plates in your plate calculator."}{" "}
          Training max = {Math.round(settings.trainingMaxPercent * 100)}% of max.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LIFT_SLOTS.map(({ slot }) => {
            const ex = getExercise(settings.variants[slot]);
            return (
              <label key={slot} className="block text-sm">
                <span className="font-medium text-ink">{ex.name}</span>
                {weightIsPerHand(ex.slug) && <span className="text-muted"> (per hand)</span>}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={maxes[slot]}
                  onChange={(e) => setMaxes((m) => ({ ...m, [slot]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <span className="mt-0.5 block text-xs text-muted">
                  {trainingMaxes[slot] ? `Training max ${Math.round(trainingMaxes[slot]!)} lb` : " "}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Program weeks">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={current?.key === t.key}
            onClick={() => setActive(t.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
              current?.key === t.key ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:bg-line/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current && (
        <div className="mt-4 grid gap-4 md:grid-cols-2" role="tabpanel">
          {current.workouts.map((w) => (
            <WorkoutCard key={w.key} workout={w} />
          ))}
        </div>
      )}
    </div>
  );
}
