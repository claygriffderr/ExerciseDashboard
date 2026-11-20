"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { completeOnboarding, savePlanSettings } from "@/app/(app)/plan-actions";
import { WorkoutCard } from "@/components/workout-card";
import { formatLong, formatShort, todayIn, WEEKDAY_SHORT } from "@/lib/dates";
import { draftToInput, ERROR_STEP, programDefaults, type Draft } from "@/lib/plan/draft";
import { EXPERIENCE_INFO, MAX_METHOD_INFO, validatePlan } from "@/lib/plan/settings";
import { DEFAULT_GEAR } from "@/lib/training/equipment";
import { getExercise } from "@/lib/training/exercises";
import { LIFT_SLOTS, type LiftSlot } from "@/lib/training/five-three-one";
import { getProgram } from "@/lib/training/programs";
import { DEFAULT_WEEKDAYS, projectSchedule } from "@/lib/training/schedule";
import { FieldError, InfoBox } from "./choice";
import { EquipmentStep, ExperienceStep, LiftsStep, OptionsStep, ProgramStep, ScheduleStep, WeightsStep } from "./steps";

const STEPS = [
  { key: "experience", label: "Experience" },
  { key: "program", label: "Program" },
  { key: "schedule", label: "Schedule" },
  { key: "lifts", label: "Lifts" },
  { key: "options", label: "Options" },
  { key: "equipment", label: "Equipment" },
  { key: "weights", label: "Starting weights" },
  { key: "review", label: "Review" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const noopSubscribe = () => () => {};

/** The browser's time zone, without a server/client mismatch on first render. */
function useBrowserTimeZone(fallback: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || fallback,
    () => fallback,
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

export type WizardProps = {
  mode: "new" | "edit";
  initial: Draft;
  defaultTimezone: string;
  /** Latest training max per exercise slug, to refill a lift when its exercise changes. */
  knownMaxes: Record<string, number>;
  /** Settings only: the plan as it is now. */
  current?: { programKey: string; startDate: string; mainPhaseStarted: boolean };
};

export function PlanWizard({ mode, initial, defaultTimezone, knownMaxes, current }: WizardProps) {
  const router = useRouter();
  const timezone = useBrowserTimeZone(defaultTimezone);
  const today = todayIn(timezone);
  const [draft, setDraft] = useState<Draft>(initial);
  const [step, setStep] = useState<StepKey>(mode === "edit" ? "review" : "experience");
  const [visited, setVisited] = useState<Set<StepKey>>(() => new Set(mode === "edit" ? STEPS.map((s) => s.key) : ["experience"]));
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const program = getProgram(draft.programKey)!;
  const switching = mode === "edit" && !!current && current.programKey !== draft.programKey;
  const startEditable = mode === "new" || switching;
  const startDate = startEditable ? (draft.startDate ?? today) : current!.startDate;
  const hasIntroPhase = program.phases.some((p) => p.key !== "main");
  const mainPhaseStarted = mode === "edit" && !switching && !!current?.mainPhaseStarted;
  const allowTest = hasIntroPhase && !mainPhaseStarted;

  const input = draftToInput({ ...draft, startDate, mode: allowTest ? draft.mode : "enter" }, timezone, today);
  const check = validatePlan(input);
  const errors: Record<string, string> = check.ok ? {} : { ...check.errors };
  if (startEditable && startDate < today) errors.startDate = "Pick today or a later start date.";
  const allErrors = { ...errors, ...serverErrors };
  const errorsFor = (key: StepKey) =>
    Object.entries(allErrors)
      .filter(([field]) => (ERROR_STEP[field] ?? "review") === key)
      .map(([, message]) => message);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerErrors({});
    setSaved(false);
  };

  const go = (key: StepKey) => {
    setShowErrors(false);
    setStep(key);
    setVisited((v) => new Set(v).add(key));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const index = STEPS.findIndex((s) => s.key === step);
  const next = () => {
    if (errorsFor(step).length) {
      setShowErrors(true);
      return;
    }
    go(STEPS[index + 1].key);
  };

  const chooseProgram = (key: string) => {
    if (key === draft.programKey) return;
    const p = getProgram(key)!;
    if (mode === "edit" && current?.programKey === key) {
      // Back to the current program: restore its saved settings.
      update({ ...initial, experienceLevel: draft.experienceLevel, barWeight: draft.barWeight, plates: draft.plates });
    } else {
      update({ ...programDefaults(p), startDate: null });
    }
  };
  const chooseExperience = (level: Draft["experienceLevel"]) => {
    const suggested = level ? EXPERIENCE_INFO[level].program : null;
    if (mode === "new" && suggested && suggested !== draft.programKey) {
      update({ experienceLevel: level, ...programDefaults(getProgram(suggested)!) });
    } else {
      update({ experienceLevel: level });
    }
  };
  const chooseVariant = (slot: LiftSlot, slug: string) => {
    const known = knownMaxes[slug];
    const lift =
      known !== undefined
        ? { method: "trainingMax" as const, weight: String(known), reps: "5" }
        : mode === "edit"
          ? { method: "recentSet" as const, weight: "", reps: "5" }
          : draft.lifts[slot];
    update({ variants: { ...draft.variants, [slot]: slug }, lifts: { ...draft.lifts, [slot]: lift } });
  };

  const firstErrorStep = () => STEPS.find((s) => errorsFor(s.key).length)?.key;
  const submit = () => {
    const bad = firstErrorStep();
    if (bad) {
      setShowErrors(true);
      if (bad !== "review") go(bad);
      setShowErrors(true);
      return;
    }
    startTransition(async () => {
      if (mode === "new") {
        const result = await completeOnboarding(input);
        if (result && !result.ok) setServerErrors(result.errors);
        return;
      }
      const result = await savePlanSettings(input);
      if (!result.ok) {
        setServerErrors(result.errors);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  const stepErrors = showErrors || step === "review" ? errorsFor(step) : [];

  return (
    <div>
      <ol className="mb-8 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label="Setup steps">
        {STEPS.map((s, i) => {
          const active = s.key === step;
          const reachable = visited.has(s.key);
          return (
            <li key={s.key} className="shrink-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => go(s.key)}
                aria-current={active ? "step" : undefined}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  active
                    ? "bg-accent text-accent-ink"
                    : reachable
                      ? "text-ink hover:bg-line/50"
                      : "cursor-default text-muted/60"
                }`}
              >
                <span className="tabular-nums">{i + 1}.</span> {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === "experience" && <ExperienceStep draft={draft} onChoose={chooseExperience} />}
      {step === "program" && <ProgramStep draft={draft} onChoose={chooseProgram} switchingFrom={current?.programKey} />}
      {step === "schedule" && (
        <ScheduleStep
          draft={draft}
          update={update}
          program={program}
          today={today}
          startDate={startDate}
          startEditable={startEditable}
          onDaysChange={(n) => update({ daysPerWeek: n, trainingWeekdays: DEFAULT_WEEKDAYS[n] ?? [] })}
        />
      )}
      {step === "lifts" && <LiftsStep draft={draft} onVariant={chooseVariant} />}
      {step === "options" && <OptionsStep draft={draft} update={update} program={program} />}
      {step === "equipment" && <EquipmentStep draft={draft} update={update} />}
      {step === "weights" && (
        <WeightsStep
          draft={draft}
          update={update}
          program={program}
          allowTest={allowTest}
          mainPhaseStarted={mainPhaseStarted}
          knownMaxes={knownMaxes}
        />
      )}
      {step === "review" && (
        <Review
          draft={draft}
          check={check}
          startDate={startDate}
          today={today}
          mode={mode}
          switching={switching}
          allowTest={allowTest}
          onEdit={go}
          errorsFor={errorsFor}
        />
      )}

      <FieldError messages={stepErrors} />

      {saved && (
        <div role="status" className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-ink">
          Saved. Your upcoming workouts now use these settings.{" "}
          <Link href="/calendar" className="font-semibold text-accent hover:underline">
            Open the calendar
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => go(STEPS[index - 1].key)}
            className="rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-line/40"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        {step !== "review" ? (
          <div className="flex gap-2">
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => (errorsFor(step).length ? setShowErrors(true) : go("review"))}
                className="rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-line/40"
              >
                Review changes
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong"
            >
              Continue
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Saving…" : mode === "new" ? "Start my plan" : switching ? "Start the new plan" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}

function Review({
  draft,
  check,
  startDate,
  today,
  mode,
  switching,
  allowTest,
  onEdit,
  errorsFor,
}: {
  draft: Draft;
  check: ReturnType<typeof validatePlan>;
  startDate: string;
  today: string;
  mode: "new" | "edit";
  switching: boolean;
  allowTest: boolean;
  onEdit: (key: StepKey) => void;
  errorsFor: (key: StepKey) => string[];
}) {
  const program = getProgram(draft.programKey)!;
  const settings = check.ok ? check.plan.settings : null;
  const days = [...draft.trainingWeekdays].sort().map((d) => WEEKDAY_SHORT[d]);
  const testing = allowTest && draft.mode === "test";

  const rows: { step: StepKey; label: string; value: React.ReactNode }[] = [
    { step: "experience", label: "Experience", value: draft.experienceLevel ? EXPERIENCE_INFO[draft.experienceLevel].label : "Not chosen" },
    { step: "program", label: "Program", value: program.name },
    {
      step: "schedule",
      label: "Schedule",
      value: `${draft.daysPerWeek} days a week (${days.join(", ")}), ${mode === "edit" && !switching ? "started" : "starting"} ${formatLong(startDate)}`,
    },
    {
      step: "lifts",
      label: "Main lifts",
      value: LIFT_SLOTS.map(({ slot }) => getExercise(draft.variants[slot]).name).join(", "),
    },
    {
      step: "options",
      label: "Options",
      value: settings ? (
        <ul className="space-y-0.5">
          {program.options
            .filter((o) => !o.showWhen || o.showWhen(settings))
            .map((o) => (
              <li key={o.key}>
                {o.label}: {o.choices.find((c) => c.value === draft.options[o.key])?.label ?? "Default"}
              </li>
            ))}
        </ul>
      ) : (
        "—"
      ),
    },
    {
      step: "equipment",
      label: "Equipment",
      value: `${fmt(draft.barWeight)} lb bar; plates ${draft.plates.map(fmt).join(", ")} lb`,
    },
    {
      step: "weights",
      label: testing ? "Starting weights" : "Training maxes",
      value: testing ? (
        "Found during the test sessions"
      ) : check.ok ? (
        <ul className="space-y-0.5">
          {LIFT_SLOTS.map(({ slot }) => (
            <li key={slot}>
              {getExercise(draft.variants[slot]).name}: {fmt(check.plan.trainingMaxes[slot] ?? 0)} lb
              {draft.lifts[slot].method !== "trainingMax" && (
                <span className="text-muted"> (from {MAX_METHOD_INFO[draft.lifts[slot].method].label.toLowerCase()})</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        "Not finished"
      ),
    },
  ];

  let preview: { date: string | undefined; title: string }[] = [];
  let first = null;
  if (check.ok && (mode === "new" || switching)) {
    const { settings: s, trainingMaxes, runIntro } = check.plan;
    const gear = { ...DEFAULT_GEAR, barWeight: draft.barWeight, plates: draft.plates };
    const list = runIntro ? program.buildIntro({ settings: s, gear }) : program.buildCycle({ settings: s, trainingMaxes, gear, cycle: 1 });
    const shown = list.slice(0, 6);
    const dates = projectSchedule(
      shown.map((w) => w.key),
      { trainingWeekdays: draft.trainingWeekdays, today: startDate > today ? startDate : today },
    );
    preview = shown.map((w) => ({ date: dates.get(w.key), title: w.title }));
    first = list[0] ?? null;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{mode === "new" ? "Review your plan" : "Your plan"}</h2>
        <p className="mt-2 max-w-2xl leading-7 text-muted">
          {mode === "new"
            ? "Check everything over. You can change any of it later in Settings."
            : switching
              ? `Starting ${program.name} replaces your upcoming workouts. Finished workouts stay in your history.`
              : "Change anything below. Saving updates your upcoming workouts; finished workouts stay as they are."}
        </p>
      </div>
      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.step} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <dt className="w-40 shrink-0 text-sm font-medium text-muted">{r.label}</dt>
            <dd className="flex-1 text-sm text-ink">
              {r.value}
              {errorsFor(r.step).length > 0 && <p className="mt-1 text-danger">{errorsFor(r.step)[0]}</p>}
            </dd>
            <dd>
              <button type="button" onClick={() => onEdit(r.step)} className="text-sm font-medium text-accent hover:underline">
                Change<span className="sr-only"> {r.label.toLowerCase()}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>

      {preview.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-ink">Your first workouts</h3>
            <ol className="mt-3 space-y-2">
              {preview.map((p, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                  <span className="w-28 shrink-0 font-medium text-ink">{p.date ? formatShort(p.date) : "—"}</span>
                  <span className="text-muted">{p.title}</span>
                </li>
              ))}
            </ol>
            {check.ok && check.plan.runIntro && (
              <div className="mt-4">
                <InfoBox>
                  Practice sessions come first. Pick light weights you could lift at least 3 more times, and focus on
                  smooth, controlled reps.
                </InfoBox>
              </div>
            )}
          </div>
          {first && (
            <div>
              <h3 className="mb-3 font-semibold text-ink">First session in detail</h3>
              <WorkoutCard workout={first} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
