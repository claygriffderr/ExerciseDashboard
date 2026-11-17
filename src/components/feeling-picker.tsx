"use client";

import { FEELING_LABELS, FEELINGS, type Feeling } from "@/lib/log/schema";

/**
 * The five feelings as a row of pill buttons. Tapping the chosen one again
 * clears it. Used on workouts and rest-day check-ins.
 */
export function FeelingPicker({
  value,
  onChange,
  labelledBy,
  disabled,
  compact,
  labels,
}: {
  value: Feeling | null;
  onChange: (next: Feeling | null) => void;
  labelledBy: string;
  disabled?: boolean;
  /** Emoji-only buttons (the full label is still read out and shown on hover). */
  compact?: boolean;
  /** Other wording for the feelings (the emoji stay the same). */
  labels?: Record<Feeling, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={labelledBy}>
      {FEELINGS.map((f) => {
        const on = value === f;
        const emoji = FEELING_LABELS[f].emoji;
        const label = labels?.[f] ?? FEELING_LABELS[f].label;
        return (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            disabled={disabled}
            onClick={() => onChange(on ? null : f)}
            className={`rounded-full border text-sm font-medium disabled:opacity-60 ${compact ? "px-3 py-2 text-lg leading-none" : "px-3.5 py-2"} ${
              on ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:border-accent/50"
            }`}
          >
            <span aria-hidden>{emoji}</span>
            {!compact && <> {label}</>}
          </button>
        );
      })}
    </div>
  );
}
