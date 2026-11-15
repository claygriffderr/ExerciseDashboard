import Link from "next/link";
import { EXERCISE_BY_SLUG } from "@/lib/training/exercises";
import type { PlannedExercise, PlannedSet, PlannedWorkout, Section } from "@/lib/training/programs/types";

const SECTION_LABELS: Record<Section, string> = {
  WARMUP: "Warm-up",
  MAIN: "Main sets",
  SUPPLEMENTAL: "Volume",
  ACCESSORY: "Assistance",
};

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function setLabel(s: PlannedSet): string {
  const reps = `${s.reps}${s.repsMax ? `–${s.repsMax}` : ""}${s.amrap ? "+" : ""}`;
  const weight = s.weight !== null ? `${fmt(s.weight)} lb` : "your choice";
  const pct = s.percent ? ` (${Math.round(s.percent * 100)}%)` : "";
  return `${reps} × ${weight}${pct}`;
}

/** Collapse identical consecutive sets: "5 sets of 10 × 50 lb". */
function groupedSets(sets: PlannedSet[]): string[] {
  const out: { label: string; count: number }[] = [];
  for (const s of sets) {
    const label = setLabel(s);
    const last = out[out.length - 1];
    if (last && last.label === label) last.count++;
    else out.push({ label, count: 1 });
  }
  return out.map((g) => (g.count > 1 ? `${g.count} sets: ${g.label}` : g.label));
}

function ExerciseRow({ e }: { e: PlannedExercise }) {
  const ex = EXERCISE_BY_SLUG.get(e.exerciseSlug);
  const rir = e.sets[0]?.repsInReserve;
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Link href={`/exercises/${e.exerciseSlug}`} className="font-medium text-ink hover:text-accent">
          {ex?.name ?? e.exerciseSlug}
        </Link>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{SECTION_LABELS[e.section]}</span>
      </div>
      <ul className="mt-1 space-y-0.5 text-sm text-muted">
        {groupedSets(e.sets).map((line, i) => (
          <li key={i} className="tabular-nums">
            {line}
          </li>
        ))}
      </ul>
      {(e.note || rir !== undefined) && (
        <p className="mt-1 text-xs text-muted">
          {e.note ?? `Leave about ${rir} reps in the tank.`}
        </p>
      )}
    </li>
  );
}

export function WorkoutCard({ workout, showTitle = true }: { workout: PlannedWorkout; showTitle?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      {showTitle && <h3 className="font-semibold text-ink">{workout.title}</h3>}
      {workout.guidance && <p className={`${showTitle ? "mt-1" : ""} text-sm text-muted`}>{workout.guidance}</p>}
      <ul className="mt-2 divide-y divide-line">
        {workout.exercises.map((e, i) => (
          <ExerciseRow key={i} e={e} />
        ))}
      </ul>
    </div>
  );
}
