"use client";

import Link from "next/link";
import { MuscleMap, MuscleLegend } from "@/components/muscle-map";
import { formatLong, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/dates";
import { daysExplanation, type Draft, type LiftDraft, type OptionValue } from "@/lib/plan/draft";
import {
  EXPERIENCE_INFO,
  EXPERIENCE_LEVELS,
  MAX_METHOD_INFO,
  MAX_METHODS,
  resolveSettings,
  trainingMaxFromEntry,
  type MaxMethod,
} from "@/lib/plan/settings";
import { EQUIPMENT_LABELS } from "@/lib/training/equipment";
import { getExercise, slotVariants, weightIsPerHand } from "@/lib/training/exercises";
import { LIFT_SLOTS, type LiftSlot } from "@/lib/training/five-three-one";
import { MUSCLE_LABELS } from "@/lib/training/muscles";
import { ALL_PLATE_SIZES, BAR_OPTIONS } from "@/lib/training/plates";
import { PROGRAMS } from "@/lib/training/programs";
import type { ProgramDefinition } from "@/lib/training/programs/types";
import { Badge, ChoiceCard, InfoBox, StepIntro } from "./choice";

type StepProps = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
};

const inputClass =
  "block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function firstSentence(text: string) {
  return text.split(/(?<=\.)\s/)[0];
}

// ─── Experience ─────────────────────────────────────────────────────────────

export function ExperienceStep({ draft, onChoose }: { draft: Draft; onChoose: (level: Draft["experienceLevel"]) => void }) {
  return (
    <div>
      <StepIntro title="How much lifting have you done?">
        This helps suggest a program and sensible starting points. Nothing here is locked in: you can change every choice
        later in Settings.
      </StepIntro>
      <fieldset className="grid gap-3">
        <legend className="sr-only">Experience</legend>
        {EXPERIENCE_LEVELS.map((level) => (
          <ChoiceCard
            key={level}
            name="experience"
            checked={draft.experienceLevel === level}
            onSelect={() => onChoose(level)}
            title={EXPERIENCE_INFO[level].label}
          >
            {EXPERIENCE_INFO[level].explanation}
          </ChoiceCard>
        ))}
      </fieldset>
    </div>
  );
}

// ─── Program ────────────────────────────────────────────────────────────────

export function ProgramStep({
  draft,
  onChoose,
  switchingFrom,
}: {
  draft: Draft;
  onChoose: (key: string) => void;
  /** Settings: the program the person is on now, when they pick another. */
  switchingFrom?: string;
}) {
  const suggested = draft.experienceLevel ? EXPERIENCE_INFO[draft.experienceLevel].program : null;
  return (
    <div>
      <StepIntro title="Choose a program">
        Both programs use Jim Wendler&apos;s 5/3/1 method: weights are based on a training max a little below your best,
        and go up slowly every few weeks. They differ in how you get started and how much work each session involves.
      </StepIntro>
      <fieldset className="grid gap-4">
        <legend className="sr-only">Program</legend>
        {PROGRAMS.map((p) => (
          <ChoiceCard
            key={p.key}
            name="program"
            checked={draft.programKey === p.key}
            onSelect={() => onChoose(p.key)}
            title={p.name}
            badges={suggested === p.key ? <Badge>Suggested for you</Badge> : null}
          >
            <p className="font-medium text-ink">{p.tagline}</p>
            <p className="mt-2">{p.summary}</p>
            <p className="mt-2">
              <span className="font-medium text-ink">Who it suits: </span>
              {p.audience}
            </p>
            <details className="mt-3 group">
              <summary className="cursor-pointer font-medium text-accent">Benefits and what it involves</summary>
              <h4 className="mt-3 font-semibold text-ink">Benefits</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {p.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <h4 className="mt-3 font-semibold text-ink">What it involves</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {p.whatItInvolves.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <Link href={`/programs/${p.key}`} target="_blank" className="mt-3 inline-block font-medium text-accent hover:underline">
                Full details and a weight preview (opens in a new tab)
              </Link>
            </details>
          </ChoiceCard>
        ))}
      </fieldset>
      {switchingFrom && switchingFrom !== draft.programKey && (
        <div className="mt-4">
          <InfoBox>
            Switching programs starts a new plan from the start date you pick. Workouts you&apos;ve finished stay in your
            history; your upcoming workouts are replaced.
          </InfoBox>
        </div>
      )}
    </div>
  );
}

// ─── Schedule ───────────────────────────────────────────────────────────────

export function ScheduleStep({
  draft,
  update,
  program,
  today,
  startDate,
  startEditable,
  onDaysChange,
}: StepProps & {
  program: ProgramDefinition;
  today: string;
  startDate: string;
  startEditable: boolean;
  onDaysChange: (days: number) => void;
}) {
  const toggleDay = (d: number) => {
    const on = draft.trainingWeekdays.includes(d);
    update({ trainingWeekdays: on ? draft.trainingWeekdays.filter((x) => x !== d) : [...draft.trainingWeekdays, d].sort() });
  };
  const picked = draft.trainingWeekdays.length;
  return (
    <div>
      <StepIntro title="When will you train?">
        Pick how often and on which days. Rest days matter: muscles get stronger while you recover, not during the workout.
      </StepIntro>

      <fieldset>
        <legend className="font-semibold text-ink">Days per week</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {program.daysPerWeekOptions.map((n) => (
            <ChoiceCard
              key={n}
              name="days"
              checked={draft.daysPerWeek === n}
              onSelect={() => onDaysChange(n)}
              title={`${n} days`}
              badges={program.defaultSettings.daysPerWeek === n ? <Badge>Recommended</Badge> : null}
            >
              {daysExplanation(program, n)}
            </ChoiceCard>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="font-semibold text-ink">Which days?</legend>
        <p className="mt-1 text-sm text-muted">
          Pick {draft.daysPerWeek}. Leaving a rest day between sessions helps when you can. ({picked} of {draft.daysPerWeek}{" "}
          picked)
        </p>
        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:max-w-xl">
          {WEEKDAY_SHORT.map((label, d) => {
            const on = draft.trainingWeekdays.includes(d);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[d]}
                onClick={() => toggleDay(d)}
                className={`rounded-lg border py-2.5 text-sm font-semibold ${
                  on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold text-ink">Start date</h3>
          {startEditable ? (
            <>
              <input
                type="date"
                aria-label="Start date"
                min={today}
                value={startDate}
                onChange={(e) => update({ startDate: e.target.value || null })}
                className={`mt-2 ${inputClass}`}
              />
              <p className="mt-1.5 text-sm text-muted">Your first workout lands on the first training day from this date.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Your plan started on {formatLong(startDate)}. Changing days only affects upcoming workouts.</p>
          )}
        </div>
        <InfoBox>
          <p className="font-semibold">Missed a day? Nothing is lost.</p>
          <p className="mt-1">
            Your workouts are a list done in order. If you miss a training day, that workout simply moves to your next
            training day. You can also move a workout to a rest day to catch up, or skip it.
          </p>
        </InfoBox>
      </div>
    </div>
  );
}

// ─── Lifts ──────────────────────────────────────────────────────────────────

const SLOT_HELP: Record<LiftSlot, string> = {
  squat: "A knee-bending leg movement. Builds the thighs and hips, and makes standing up from low seats easier.",
  bench: "A horizontal push. Builds the chest, front shoulders and triceps.",
  deadlift: "Lifting a weight from the floor with a flat back. Builds the hips, hamstrings and back, and trains safe lifting.",
  press: "Pushing a weight overhead. Builds the shoulders and triceps and asks your core to keep you steady.",
};

export function LiftsStep({ draft, onVariant }: { draft: Draft; onVariant: (slot: LiftSlot, slug: string) => void }) {
  return (
    <div>
      <StepIntro title="Choose your main lifts">
        5/3/1 is built around four movements. Each has easier versions, so pick what suits your body and equipment today.
        You can switch later as you get comfortable.
      </StepIntro>
      <div className="space-y-8">
        {LIFT_SLOTS.map(({ slot, label }) => {
          const selected = getExercise(draft.variants[slot]);
          return (
            <fieldset key={slot} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <legend className="px-1 text-lg font-semibold text-ink">{label}</legend>
              <p className="text-sm text-muted">{SLOT_HELP[slot]}</p>
              <div className="mt-4 grid gap-5 md:grid-cols-[1fr_220px]">
                <div className="grid gap-3">
                  {slotVariants(slot).map((ex) => (
                    <ChoiceCard
                      key={ex.slug}
                      name={`variant-${slot}`}
                      checked={draft.variants[slot] === ex.slug}
                      onSelect={() => onVariant(slot, ex.slug)}
                      title={ex.name}
                      badges={
                        <>
                          <Badge tone="muted">{EQUIPMENT_LABELS[ex.equipment]}</Badge>
                          {ex.beginnerFriendly && <Badge>Beginner friendly</Badge>}
                        </>
                      }
                    >
                      {firstSentence(ex.description)}
                    </ChoiceCard>
                  ))}
                </div>
                <div>
                  <MuscleMap
                    primary={selected.primary}
                    secondary={selected.secondary}
                    className="mx-auto h-48 w-48"
                    title={`Muscles worked by the ${selected.name.toLowerCase()}`}
                  />
                  <div className="mt-2 flex justify-center">
                    <MuscleLegend />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted">
                    Mainly {selected.primary.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(", ")}
                  </p>
                </div>
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-accent">How to do the {selected.name.toLowerCase()}</summary>
                <p className="mt-2 leading-6 text-muted">{selected.description}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
                  {selected.cues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
                {selected.easier && <p className="mt-2 text-muted">Easier option: {selected.easier}</p>}
              </details>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

// ─── Program options ────────────────────────────────────────────────────────

export function OptionsStep({ draft, update, program }: StepProps & { program: ProgramDefinition }) {
  const settings = resolveSettings(program, draft);
  const visible = program.options.filter((o) => !o.showWhen || o.showWhen(settings));
  const setOption = (key: string, value: OptionValue) => update({ options: { ...draft.options, [key]: value } });
  return (
    <div>
      <StepIntro title="Fine-tune the program">
        The recommended choices suit most people. Each one explains what it changes.
      </StepIntro>
      {visible.length === 0 && <p className="text-muted">Nothing else to choose for this program.</p>}
      <div className="space-y-8">
        {visible.map((o) => (
          <fieldset key={o.key}>
            <legend className="font-semibold text-ink">{o.label}</legend>
            <p className="mt-1 text-sm text-muted">{o.explanation}</p>
            <div className={`mt-3 grid gap-3 ${o.choices.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
              {o.choices.map((c) => (
                <ChoiceCard
                  key={String(c.value)}
                  name={`option-${o.key}`}
                  checked={draft.options[o.key] === c.value}
                  onSelect={() => setOption(o.key, c.value)}
                  title={c.label}
                  badges={c.recommended ? <Badge>Recommended</Badge> : null}
                >
                  {c.explanation}
                </ChoiceCard>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

// ─── Equipment ──────────────────────────────────────────────────────────────

export function EquipmentStep({ draft, update }: StepProps) {
  const usesBarbell = LIFT_SLOTS.some(({ slot }) => getExercise(draft.variants[slot]).equipment === "barbell");
  const togglePlate = (p: number) => {
    const on = draft.plates.includes(p);
    update({ plates: on ? draft.plates.filter((x) => x !== p) : [...draft.plates, p].sort((a, b) => b - a) });
  };
  return (
    <div>
      <StepIntro title="Your equipment">
        Planned weights are rounded to what you can actually load, so you never have to do plate math mid-workout. These
        are the same settings as the Plates calculator.
      </StepIntro>
      {!usesBarbell && (
        <div className="mb-6">
          <InfoBox>
            None of your main lifts use a barbell right now, so you can leave these as they are. Dumbbell weights round to 5
            lb steps and kettlebells to the nearest common size.
          </InfoBox>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="font-semibold text-ink">Bar</span>
          <select
            value={draft.barWeight}
            onChange={(e) => update({ barWeight: Number(e.target.value) })}
            className={`mt-2 ${inputClass}`}
          >
            {BAR_OPTIONS.map((b) => (
              <option key={b.weight} value={b.weight}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="font-semibold text-ink">Plate sizes you have (lb)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_PLATE_SIZES.map((p) => {
              const on = draft.plates.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePlate(p)}
                  className={`min-w-12 rounded-full border px-3 py-1.5 text-sm font-medium ${
                    on ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {fmt(p)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">Small plates (2.5 lb and under) make the gentle steps between weeks possible.</p>
        </fieldset>
      </div>
    </div>
  );
}

// ─── Starting weights ───────────────────────────────────────────────────────

export function WeightsStep({
  draft,
  update,
  program,
  allowTest,
  mainPhaseStarted,
  knownMaxes,
}: StepProps & {
  program: ProgramDefinition;
  allowTest: boolean;
  /** Settings, mid-plan: show training maxes to adjust instead of first-time entry. */
  mainPhaseStarted: boolean;
  knownMaxes: Record<string, number>;
}) {
  const settings = resolveSettings(program, draft);
  const tmPercent = Math.round(settings.trainingMaxPercent * 100);
  const setLift = (slot: LiftSlot, patch: Partial<LiftDraft>) =>
    update({ lifts: { ...draft.lifts, [slot]: { ...draft.lifts[slot], ...patch } } });

  return (
    <div>
      <StepIntro title={mainPhaseStarted ? "Training maxes" : "Starting weights"}>
        {mainPhaseStarted
          ? "Every planned weight is worked out from these. Lower one if that lift feels too heavy, or raise it if it's been too easy."
          : `5/3/1 bases every weight on a training max: ${tmPercent}% of the most you could lift once. Starting a little light is deliberate. It keeps sets safe and leaves room to progress for months.`}
      </StepIntro>

      {allowTest && (
        <fieldset className="mb-8 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">How to set starting weights</legend>
          <ChoiceCard
            name="weights-mode"
            checked={draft.mode === "test"}
            onSelect={() => update({ mode: "test" })}
            title="Find them during the program"
            badges={<Badge>Recommended</Badge>}
          >
            After the practice weeks, two short test sessions build up to a comfortable set of 5 on each lift, with reps to
            spare. The app works out your training maxes from those. No maxing out.
          </ChoiceCard>
          <ChoiceCard
            name="weights-mode"
            checked={draft.mode === "enter"}
            onSelect={() => update({ mode: "enter" })}
            title="I know my numbers"
          >
            Enter a recent set or your max for each lift. You&apos;ll skip the practice and test sessions and go straight to
            the main program.
          </ChoiceCard>
        </fieldset>
      )}

      {draft.mode === "test" && allowTest ? (
        <InfoBox>
          Nothing to enter now. Use light weights during practice, and the test sessions will guide you to the right
          numbers.
        </InfoBox>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {LIFT_SLOTS.map(({ slot, label }) => {
            const ex = getExercise(draft.variants[slot]);
            const lift = draft.lifts[slot];
            const weight = Number.parseFloat(lift.weight);
            const reps = Number.parseInt(lift.reps, 10);
            const tm =
              weight > 0 && (lift.method !== "recentSet" || reps > 0)
                ? trainingMaxFromEntry({ method: lift.method, weight, reps: reps > 0 ? reps : undefined }, settings.trainingMaxPercent)
                : null;
            const known = knownMaxes[ex.slug];
            const perHand = weightIsPerHand(ex.slug) ? " (per hand)" : "";
            return (
              <div key={slot} className="rounded-2xl border border-line bg-surface p-4">
                <h3 className="font-semibold text-ink">
                  {ex.name}
                  <span className="font-normal text-muted">
                    {" "}
                    · {label}
                    {perHand}
                  </span>
                </h3>
                <label className="mt-3 block text-sm">
                  <span className="font-medium text-ink">What do you know?</span>
                  <select
                    value={lift.method}
                    onChange={(e) => setLift(slot, { method: e.target.value as MaxMethod })}
                    className={`mt-1 ${inputClass}`}
                  >
                    {MAX_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {MAX_METHOD_INFO[m].label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-muted">{MAX_METHOD_INFO[lift.method].explanation}</span>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="font-medium text-ink">Weight (lb{perHand})</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={lift.weight}
                      onChange={(e) => setLift(slot, { weight: e.target.value })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  {lift.method === "recentSet" && (
                    <label className="block text-sm">
                      <span className="font-medium text-ink">Reps</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={15}
                        value={lift.reps}
                        onChange={(e) => setLift(slot, { reps: e.target.value })}
                        className={`mt-1 ${inputClass}`}
                      />
                    </label>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted" aria-live="polite">
                  {tm !== null ? (
                    <>
                      Training max: <span className="font-semibold text-ink">{fmt(tm)} lb</span>
                      {known !== undefined && known !== tm && <> (now {fmt(known)} lb)</>}
                    </>
                  ) : (
                    "Enter a weight to see your training max."
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
