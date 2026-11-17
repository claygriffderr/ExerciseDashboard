"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { formatShort } from "@/lib/dates";
import {
  CUSTOM_EQUIPMENT,
  NOTES_MAX,
  PATTERNS,
  type Feeling,
  type LibraryExercise,
  type SetTarget,
  toLog,
  type WorkoutLog,
} from "@/lib/log/schema";
import { restAfterTick, type RestSettings } from "@/lib/log/rest";
import type { ActionResult } from "@/lib/plan/workouts";
import { EQUIPMENT_LABELS } from "@/lib/training/equipment";
import { PATTERN_LABELS } from "@/lib/training/exercises";
import { MUSCLE_GROUPS, MUSCLE_LABELS } from "@/lib/training/muscles";
import {
  completeWorkoutAction,
  createCustomExerciseAction,
  moveWorkoutAction,
  saveWorkoutLogAction,
  skipWorkoutAction,
  undoWorkoutAction,
  unpinWorkoutAction,
} from "../../plan-actions";
import { FeelingPicker } from "@/components/feeling-picker";
import { RestCountdown, RestSettingsPanel, useRestTimer } from "./rest-timer";

// ─── Types passed from the page ─────────────────────────────────────────────

export type SetDraft = { key: string; id?: string; target: SetTarget | null; weight: string; reps: string; done: boolean };
export type ExerciseDraft = {
  key: string;
  id?: string;
  exerciseId: string;
  name: string;
  /** Link to the library page, for built-in exercises. */
  slug: string | null;
  section: "WARMUP" | "MAIN" | "SUPPLEMENTAL" | "ACCESSORY";
  note: string | null;
  perHand: boolean;
  /** Leave this many reps in the tank. */
  rir: number | null;
  sets: SetDraft[];
};

export type SessionProps = {
  workoutId: string;
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  phase: string | null;
  guidance: string | null;
  exercises: ExerciseDraft[];
  feeling: Feeling | null;
  notes: string;
  library: LibraryExercise[];
  rest: RestSettings;
  /** Null when the workout belongs to an earlier plan: logging only. */
  plan: {
    isNext: boolean;
    canUndo: boolean;
    today: string;
    earliestDone: string | null;
    projectedDate: string | null;
    earliestMove: string | null;
    pinned: boolean;
    previous: { title: string; date: string } | null;
  } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<ExerciseDraft["section"], string> = {
  WARMUP: "Warm-up",
  MAIN: "Main sets",
  SUPPLEMENTAL: "Volume",
  ACCESSORY: "Assistance",
};

const inputClass =
  "block w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-base text-ink tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const primary =
  "rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70";
const secondary = "rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-line/40 disabled:opacity-60";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

let nextKey = 0;
const newKey = () => `new-${nextKey++}`;

function targetText(t: SetTarget | null): string {
  if (!t) return "Extra set";
  const reps = t.reps === null ? "" : `${t.reps}${t.repsMax ? `–${t.repsMax}` : ""}${t.amrap ? "+" : ""}`;
  const weight = t.weight !== null ? `${fmt(t.weight)} lb` : "your choice";
  return reps ? `${reps} × ${weight}` : weight;
}

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : result.error);
      if (result.ok) onOk?.();
    });
  return { error, setError, pending, run };
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 text-sm text-danger">
      {message}
    </p>
  );
}

// ─── The page body ──────────────────────────────────────────────────────────

export function WorkoutSession(props: SessionProps) {
  const [exercises, setExercises] = useState<ExerciseDraft[]>(props.exercises);
  const [feeling, setFeeling] = useState<Feeling | null>(props.feeling);
  const [notes, setNotes] = useState(props.notes);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const save = useAction();
  const isTest = props.phase === "find";
  const [restSettings, setRestSettings] = useState(props.rest);
  const timer = useRestTimer(props.workoutId);
  const live = props.status === "PLANNED";
  const timing = live && restSettings.enabled;
  const sections = [...new Set(exercises.map((e) => e.section))];

  const change = (fn: (list: ExerciseDraft[]) => ExerciseDraft[]) => {
    setExercises(fn);
    setDirty(true);
    setSavedAt(null);
  };
  /** Start the rest timer after a tick, from the exercises as they are once the tick lands. */
  const restAfter = (after: ExerciseDraft[], ei: number, setKey: string) => {
    if (!timing) return;
    const next = restAfterTick(after, ei);
    if (!next) return timer.clear();
    timer.start({ exerciseKey: after[ei].key, setKey, label: next.label, total: restSettings.seconds[next.key] });
  };
  const updateSet = (ei: number, si: number, patch: Partial<SetDraft>) => {
    const apply = (list: ExerciseDraft[]) =>
      list.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) }));
    const before = exercises[ei]?.sets[si];
    if (before && patch.done === true && !before.done) restAfter(apply(exercises), ei, before.key);
    if (before && patch.done === false && timer.rest?.setKey === before.key) timer.clear();
    change(apply);
  };

  const log = () => toLog(exercises, feeling, notes);
  const saveLog = () =>
    save.run(
      () => saveWorkoutLogAction(props.workoutId, log()),
      () => {
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      },
    );

  /** Test sessions need a weight and reps on each main lift. */
  const testProblem = () => {
    if (!isTest) return null;
    for (const e of exercises.filter((x) => x.section === "MAIN")) {
      const ok = e.sets.some((s) => Number.parseFloat(s.weight) > 0 && Number.parseInt(s.reps, 10) > 0);
      if (!ok) return `Log the weight and reps of your test set for the ${e.name.toLowerCase()}.`;
    }
    return null;
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4">
        {(props.guidance || live) && (
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            {props.guidance && <p className="leading-6 text-muted">{props.guidance}</p>}
            {live && (
              <div className={props.guidance ? "mt-3 border-t border-line pt-3" : ""}>
                <RestSettingsPanel
                  settings={restSettings}
                  sections={sections}
                  onChange={(next) => {
                    setRestSettings(next);
                    if (!next.enabled) timer.clear();
                  }}
                />
              </div>
            )}
          </div>
        )}
        {isTest && props.status === "PLANNED" && (
          <p className="rounded-2xl border border-accent/40 bg-accent/5 p-4 text-sm leading-6 text-ink">
            Log your heaviest set of 5 (with about 2 reps left in the tank) for each lift. Your training maxes are worked out
            from those when you mark the workout done.
          </p>
        )}

        {exercises.map((e, ei) => (
          <ExerciseCard
            key={e.key}
            e={e}
            onSet={(si, patch) => updateSet(ei, si, patch)}
            onAddSet={() =>
              change((list) =>
                list.map((x, i) => {
                  if (i !== ei) return x;
                  const last = x.sets.at(-1);
                  return {
                    ...x,
                    sets: [...x.sets, { key: newKey(), target: null, weight: last?.weight ?? "", reps: last?.reps ?? "", done: false }],
                  };
                }),
              )
            }
            onRemoveSet={(si) => change((list) => list.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.filter((_, j) => j !== si) })))}
            onAllDone={() => {
              const apply = (list: ExerciseDraft[]) =>
                list.map((x, i) =>
                  i !== ei
                    ? x
                    : {
                        ...x,
                        sets: x.sets.map((s) => ({
                          ...s,
                          done: true,
                          weight: s.weight || (s.target?.weight != null ? String(s.target.weight) : ""),
                          reps: s.reps || (s.target?.reps != null && !s.target.amrap ? String(s.target.reps) : ""),
                        })),
                      },
                );
              restAfter(apply(exercises), ei, `all-${e.key}`);
              change(apply);
            }}
            rest={
              timing && timer.rest?.exerciseKey === e.key ? (
                <RestCountdown
                  key={timer.rest.setKey}
                  rest={timer.rest}
                  onExtend={() => timer.extend(30)}
                  onHide={timer.clear}
                />
              ) : null
            }
            onRemove={() => change((list) => list.filter((_, i) => i !== ei))}
          />
        ))}

        <AddExercise
          library={props.library}
          onAdd={(ex) =>
            change((list) => [
              ...list,
              {
                key: newKey(),
                exerciseId: ex.id,
                name: ex.name,
                slug: null,
                section: "ACCESSORY",
                note: null,
                perHand: ex.equipment === "dumbbell",
                rir: null,
                sets: [0, 1, 2].map(() => ({ key: newKey(), target: null, weight: "", reps: "", done: false })),
              },
            ])
          }
        />

        <section aria-labelledby="feeling-title" className="rounded-2xl border border-line bg-surface p-4">
          <h2 id="feeling-title" className="font-semibold text-ink">
            How did it feel?
          </h2>
          <div className="mt-3">
            <FeelingPicker
              value={feeling}
              labelledBy="feeling-title"
              onChange={(next) => {
                setFeeling(next);
                setDirty(true);
                setSavedAt(null);
              }}
            />
          </div>
          <label className="mt-4 block">
            <span className="font-semibold text-ink">Notes</span>
            <span className="ml-2 text-sm text-muted">Sleep, energy, aches, what went well, what to change</span>
            <textarea
              value={notes}
              maxLength={NOTES_MAX}
              rows={4}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
                setSavedAt(null);
              }}
              className={`mt-2 ${inputClass}`}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveLog} disabled={save.pending || !dirty} className={secondary}>
              {save.pending ? "Saving…" : "Save log"}
            </button>
            <span className="text-sm text-muted" aria-live="polite">
              {dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt}` : ""}
            </span>
          </div>
          <ErrorText message={save.error} />
        </section>
      </div>

      <div className="space-y-4">
        {props.plan ? (
          <PlanActions
            {...props}
            plan={props.plan}
            getLog={log}
            check={testProblem}
            onSaved={() => setDirty(false)}
          />
        ) : (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
            This workout is from an earlier plan. You can still edit its log.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── One exercise with its sets ─────────────────────────────────────────────

function ExerciseCard({
  e,
  onSet,
  onAddSet,
  onRemoveSet,
  onAllDone,
  onRemove,
  rest,
}: {
  e: ExerciseDraft;
  onSet: (si: number, patch: Partial<SetDraft>) => void;
  onAddSet: () => void;
  onRemoveSet: (si: number) => void;
  onAllDone: () => void;
  onRemove: () => void;
  /** The rest timer, when it belongs under this exercise. */
  rest: ReactNode;
}) {
  const done = e.sets.filter((s) => s.done).length;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold text-ink">
          {e.slug ? (
            <Link href={`/exercises/${e.slug}`} className="hover:text-accent">
              {e.name}
            </Link>
          ) : (
            e.name
          )}
        </h2>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {SECTION_LABELS[e.section]} · {done}/{e.sets.length} done
        </span>
      </div>
      {(e.note || e.rir !== null) && (
        <p className="mt-1 text-xs text-muted">{e.note ?? `Leave about ${e.rir} reps in the tank.`}</p>
      )}

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4.5rem_3.75rem_2.75rem] items-center gap-x-2 gap-y-2 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_5rem_3rem]">
        <span className="text-xs font-medium text-muted">Plan</span>
        <span className="text-xs font-medium text-muted">lb{e.perHand ? " each" : ""}</span>
        <span className="text-xs font-medium text-muted">Reps</span>
        <span className="text-xs font-medium text-muted">Done</span>
        {e.sets.map((s, si) => (
          <SetRow key={s.key} s={s} index={si} name={e.name} onChange={(p) => onSet(si, p)} onRemove={() => onRemoveSet(si)} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <button type="button" onClick={onAddSet} className="font-medium text-accent hover:underline">
          + Add set
        </button>
        {done < e.sets.length && (
          <button type="button" onClick={onAllDone} className="font-medium text-accent hover:underline">
            Mark all done as planned
          </button>
        )}
        {e.section === "ACCESSORY" && (
          <button type="button" onClick={onRemove} className="font-medium text-muted hover:text-danger">
            Remove exercise
          </button>
        )}
      </div>
      {rest}
    </section>
  );
}

function SetRow({
  s,
  index,
  name,
  onChange,
  onRemove,
}: {
  s: SetDraft;
  index: number;
  name: string;
  onChange: (patch: Partial<SetDraft>) => void;
  onRemove: () => void;
}) {
  const label = `${name}, set ${index + 1}`;
  const toggle = () => {
    if (s.done) return onChange({ done: false });
    // Ticking a set with nothing typed means it went as planned.
    onChange({
      done: true,
      weight: s.weight || (s.target?.weight != null ? String(s.target.weight) : ""),
      reps: s.reps || (s.target?.reps != null && !s.target.amrap ? String(s.target.reps) : ""),
    });
  };
  return (
    <>
      <span className="min-w-0 text-ink">
        <span className="text-muted">{index + 1}.</span> <span className="tabular-nums">{targetText(s.target)}</span>
        {s.target?.amrap && <span className="block text-xs text-muted">As many good reps as you can</span>}
        {!s.target && (
          <button type="button" onClick={onRemove} className="ml-2 text-xs text-muted hover:text-danger" aria-label={`Remove ${label}`}>
            Remove
          </button>
        )}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-label={`${label} weight`}
        placeholder={s.target?.weight != null ? fmt(s.target.weight) : "lb"}
        value={s.weight}
        onChange={(ev) => onChange({ weight: ev.target.value })}
        className={inputClass}
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`${label} reps`}
        placeholder={s.target?.reps != null && !s.target.amrap ? String(s.target.reps) : "reps"}
        value={s.reps}
        onChange={(ev) => onChange({ reps: ev.target.value })}
        className={inputClass}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={s.done}
        aria-label={`${label} done`}
        onClick={toggle}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-bold ${
          s.done ? "border-success bg-success text-white" : "border-line text-muted hover:border-success"
        }`}
      >
        ✓
      </button>
    </>
  );
}

// ─── Adding accessories ─────────────────────────────────────────────────────

function AddExercise({ library, onAdd }: { library: LibraryExercise[]; onAdd: (ex: LibraryExercise) => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<LibraryExercise[]>([]);
  const all = useMemo(() => [...extra, ...library], [extra, library]);
  const q = query.trim().toLowerCase();
  const matches = all
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.primary.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(q)))
    .sort((a, b) => Number(b.custom) - Number(a.custom) || Number(a.pattern === "main") - Number(b.pattern === "main") || a.name.localeCompare(b.name));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-line p-4 text-left font-medium text-accent hover:border-accent/60"
      >
        + Add an exercise
      </button>
    );
  }

  return (
    <section aria-labelledby="add-title" className="rounded-2xl border border-accent/40 bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="add-title" className="font-semibold text-ink">
          Add an exercise
        </h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-muted hover:text-ink">
          Close
        </button>
      </div>
      {creating ? (
        <CustomExerciseForm
          onCancel={() => setCreating(false)}
          onCreated={(ex) => {
            setExtra((x) => [ex, ...x]);
            onAdd(ex);
            setCreating(false);
            setOpen(false);
          }}
        />
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or muscle"
            aria-label="Search exercises"
            className={`mt-3 ${inputClass}`}
          />
          <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {matches.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(ex);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent/5"
                >
                  <span>
                    <span className="font-medium text-ink">{ex.name}</span>
                    {ex.custom && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-strong">Yours</span>}
                    <span className="block text-xs text-muted">
                      {[PATTERN_LABELS[ex.pattern as keyof typeof PATTERN_LABELS], ex.primary.map((m) => MUSCLE_LABELS[m]).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden className="text-accent">
                    +
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No matches.</li>}
          </ul>
          <button type="button" onClick={() => setCreating(true)} className="mt-3 text-sm font-medium text-accent hover:underline">
            Can&apos;t find it? Create your own exercise
          </button>
        </>
      )}
    </section>
  );
}

function CustomExerciseForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (ex: LibraryExercise) => void }) {
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState<(typeof PATTERNS)[number]>("push");
  const [equipment, setEquipment] = useState<(typeof CUSTOM_EQUIPMENT)[number]>("dumbbell");
  const [muscles, setMuscles] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCustomExerciseAction({ name, pattern, equipment, primaryMuscles: muscles, description });
      if (result.ok) onCreated(result.exercise);
      else setError(result.error);
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-sm text-muted">Your exercise is saved to your library, so you can add it to any workout.</p>
      <label className="block text-sm">
        <span className="font-medium text-ink">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-ink">Type</span>
          <select value={pattern} onChange={(e) => setPattern(e.target.value as typeof pattern)} className={`mt-1 ${inputClass}`}>
            {PATTERNS.map((p) => (
              <option key={p} value={p}>
                {PATTERN_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Equipment</span>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as typeof equipment)} className={`mt-1 ${inputClass}`}>
            {CUSTOM_EQUIPMENT.map((q) => (
              <option key={q} value={q}>
                {q === "other" ? "Other" : EQUIPMENT_LABELS[q]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Main muscles (optional)</legend>
        <div className="mt-2 space-y-2">
          {MUSCLE_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-xs text-muted sm:w-36">{g.label}</span>
              {g.muscles.map((m) => {
                const on = muscles.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMuscles((cur) => (on ? cur.filter((x) => x !== m) : [...cur, m].slice(0, 6)))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      on ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="font-medium text-ink">How to do it (optional)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={2} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Create and add"}
        </button>
        <button type="button" onClick={onCancel} className={secondary}>
          Back
        </button>
      </div>
      <ErrorText message={error} />
    </form>
  );
}

// ─── Done, skip, move, undo ─────────────────────────────────────────────────

function PlanActions({
  workoutId,
  status,
  plan,
  getLog,
  check,
  onSaved,
}: SessionProps & {
  plan: NonNullable<SessionProps["plan"]>;
  getLog: () => WorkoutLog;
  check: () => string | null;
  onSaved: () => void;
}) {
  if (status !== "PLANNED") return plan.canUndo ? <UndoCard workoutId={workoutId} status={status} /> : null;
  return (
    <>
      {plan.isNext ? (
        <FinishCard workoutId={workoutId} plan={plan} getLog={getLog} check={check} onSaved={onSaved} />
      ) : (
        plan.previous && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-6 text-muted">
            This comes after <span className="font-medium text-ink">{plan.previous.title}</span> ({formatShort(plan.previous.date)}).
            Workouts are done in order, so finish or skip that one first. You can still log sets here ahead of time.
          </div>
        )
      )}
      <MoveCard workoutId={workoutId} plan={plan} />
    </>
  );
}

function FinishCard({
  workoutId,
  plan,
  getLog,
  check,
  onSaved,
}: {
  workoutId: string;
  plan: NonNullable<SessionProps["plan"]>;
  getLog: () => WorkoutLog;
  check: () => string | null;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(plan.today);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { error, setError, pending, run } = useAction();

  const finish = () => {
    const problem = check();
    if (problem) return setError(problem);
    run(() => completeWorkoutAction(workoutId, { date, log: getLog() }), onSaved);
  };

  return (
    <section aria-labelledby="finish-title" className="rounded-2xl border border-accent/40 bg-surface p-5">
      <h2 id="finish-title" className="text-lg font-semibold text-ink">
        Finished this workout?
      </h2>
      <p className="mt-1 text-sm text-muted">Your log is saved along with it.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="text-muted">Day you did it</span>
          <input
            type="date"
            value={date}
            max={plan.today}
            min={plan.earliestDone ?? undefined}
            onChange={(e) => setDate(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button type="button" onClick={finish} disabled={pending} className={primary}>
          {pending ? "Saving…" : "Mark as done"}
        </button>
      </div>
      <ErrorText message={error} />

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

function MoveCard({ workoutId, plan }: { workoutId: string; plan: NonNullable<SessionProps["plan"]> }) {
  const min = plan.earliestMove && plan.earliestMove > plan.today ? plan.earliestMove : plan.today;
  const [date, setDate] = useState(plan.projectedDate ?? min);
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
          <input type="date" value={date} min={min} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <button
          type="button"
          disabled={pending || !date || date === plan.projectedDate}
          onClick={() => run(() => moveWorkoutAction(workoutId, date))}
          className={secondary}
        >
          {pending ? "Moving…" : "Move"}
        </button>
        {plan.pinned && (
          <button type="button" disabled={pending} onClick={() => run(() => unpinWorkoutAction(workoutId))} className={secondary}>
            Back to its usual day
          </button>
        )}
      </div>
      <ErrorText message={error} />
    </section>
  );
}

function UndoCard({ workoutId, status }: { workoutId: string; status: "COMPLETED" | "SKIPPED" }) {
  const { error, pending, run } = useAction();
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm leading-6 text-muted">
        {status === "COMPLETED" ? "Marked as done by mistake?" : "Skipped by mistake?"} Undo it and this becomes your next
        workout again. Your log is kept.
      </p>
      <button type="button" disabled={pending} onClick={() => run(() => undoWorkoutAction(workoutId))} className={`mt-3 ${secondary}`}>
        {pending ? "Undoing…" : status === "COMPLETED" ? "Mark as not done" : "Undo skip"}
      </button>
      <ErrorText message={error} />
    </section>
  );
}
