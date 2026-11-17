"use client";

import { useState, useTransition } from "react";
import { FeelingPicker } from "@/components/feeling-picker";
import { CHECK_IN_TAG_LABELS, CHECK_IN_TAGS, FEELING_SHORT, type CheckIn, type CheckInTag } from "@/lib/log/checkin";
import { NOTES_MAX, type Feeling } from "@/lib/log/schema";
import { saveCheckInAction } from "../../checkin-actions";

const inputClass =
  "block w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function CheckInForm({ date, isToday, initial }: { date: string; isToday: boolean; initial: CheckIn | null }) {
  const [feeling, setFeeling] = useState<Feeling | null>(initial?.feeling ?? null);
  const [tags, setTags] = useState<CheckInTag[]>(initial?.tags ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const touch = () => {
    setDirty(true);
    setSavedAt(null);
  };

  const save = () =>
    startTransition(async () => {
      const result = await saveCheckInAction({ date, feeling, tags, notes });
      if (result.ok) {
        setError(null);
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      } else {
        setError(result.error);
      }
    });

  return (
    <form
      className="space-y-6 rounded-2xl border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section>
        <h2 id="checkin-feeling" className="font-semibold text-ink">
          {isToday ? "How are you feeling today?" : "How did you feel that day?"}
        </h2>
        <div className="mt-3">
          <FeelingPicker
            value={feeling}
            labels={FEELING_SHORT}
            labelledBy="checkin-feeling"
            onChange={(next) => {
              setFeeling(next);
              touch();
            }}
          />
        </div>
      </section>

      <section>
        <h2 id="checkin-tags" className="font-semibold text-ink">
          Anything else? <span className="font-normal text-muted">(optional, pick any)</span>
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="checkin-tags">
          {CHECK_IN_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setTags((list) => (on ? list.filter((x) => x !== t) : [...list, t]));
                  touch();
                }}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium ${
                  on ? "border-accent bg-accent/15 text-ink" : "border-line text-ink hover:border-accent/50"
                }`}
              >
                {on && <span aria-hidden>✓ </span>}
                {CHECK_IN_TAG_LABELS[t]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">&ldquo;Active day&rdquo; means light activity like a walk, yard work or a bike ride.</p>
      </section>

      <label className="block">
        <span className="font-semibold text-ink">Notes</span>
        <span className="ml-2 text-sm text-muted">Sleep, energy, aches, what you did</span>
        <textarea
          value={notes}
          maxLength={NOTES_MAX}
          rows={4}
          onChange={(e) => {
            setNotes(e.target.value);
            touch();
          }}
          className={`mt-2 ${inputClass}`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt}` : ""}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
