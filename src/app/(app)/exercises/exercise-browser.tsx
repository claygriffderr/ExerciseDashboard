"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MuscleMap } from "@/components/muscle-map";
import { EQUIPMENT_LABELS } from "@/lib/training/equipment";
import { PATTERN_LABELS, type CatalogExercise, type MovementPattern } from "@/lib/training/exercises";
import { MUSCLE_GROUPS, MUSCLE_LABELS, type Muscle } from "@/lib/training/muscles";

const PATTERNS: (MovementPattern | "all")[] = ["all", "main", "push", "pull", "legs", "core"];

export function ExerciseBrowser({ exercises }: { exercises: CatalogExercise[] }) {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState<MovementPattern | "all">("all");
  const [muscle, setMuscle] = useState<Muscle | "">("");
  const [beginnerOnly, setBeginnerOnly] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (pattern === "all" || e.pattern === pattern) &&
        (!muscle || e.primary.includes(muscle) || e.secondary.includes(muscle)) &&
        (!beginnerOnly || e.beginnerFriendly) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, query, pattern, muscle, beginnerOnly]);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 sm:w-56"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type">
          {PATTERNS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPattern(p)}
              aria-pressed={pattern === p}
              className={`rounded-full border px-3 py-1 text-sm ${
                pattern === p ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:bg-line/40"
              }`}
            >
              {p === "all" ? "All" : PATTERN_LABELS[p]}
            </button>
          ))}
        </div>
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value as Muscle | "")}
          aria-label="Muscle"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="">Any muscle</option>
          {MUSCLE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.muscles.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABELS[m]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={beginnerOnly} onChange={(e) => setBeginnerOnly(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Beginner friendly only
        </label>
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {shown.length} {shown.length === 1 ? "exercise" : "exercises"}
      </p>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/exercises/${e.slug}`}
              className="flex h-full gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/60 hover:shadow-sm"
            >
              <MuscleMap primary={e.primary} secondary={e.secondary} className="h-24 w-24 shrink-0" title={`Muscles worked by ${e.name}`} />
              <div className="min-w-0">
                <h2 className="font-semibold text-ink">{e.name}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {PATTERN_LABELS[e.pattern]} · {EQUIPMENT_LABELS[e.equipment]}
                </p>
                <p className="mt-1.5 text-sm text-muted">{e.primary.map((m) => MUSCLE_LABELS[m]).join(", ")}</p>
                {e.beginnerFriendly && (
                  <span className="mt-2 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    Beginner friendly
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
