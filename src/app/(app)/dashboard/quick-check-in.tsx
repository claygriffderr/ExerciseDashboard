"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FeelingPicker } from "@/components/feeling-picker";
import { FEELING_SHORT } from "@/lib/log/checkin";
import type { Feeling } from "@/lib/log/schema";
import { quickCheckInAction } from "../checkin-actions";

/** "How are you feeling?" on the dashboard for a day without a workout. One tap saves. */
export function QuickCheckIn({ date, heading, initial }: { date: string; heading: string; initial: Feeling | null }) {
  const [feeling, setFeeling] = useState<Feeling | null>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (next: Feeling | null) => {
    const before = feeling;
    setFeeling(next);
    setSaved(false);
    startTransition(async () => {
      const result = await quickCheckInAction(date, next);
      if (result.ok) {
        setError(null);
        setSaved(true);
      } else {
        setFeeling(before);
        setError(result.error);
      }
    });
  };

  return (
    <section aria-labelledby="quick-checkin-title" className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <h2 id="quick-checkin-title" className="font-semibold text-ink">
        {heading} How are you feeling?
      </h2>
      <div className="mt-3">
        <FeelingPicker value={feeling} onChange={choose} labelledBy="quick-checkin-title" disabled={pending} compact />
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {pending
          ? "Saving…"
          : saved && feeling
            ? `Saved: ${FEELING_SHORT[feeling]}. `
            : saved
              ? "Cleared. "
              : "One tap saves it. "}
        <Link href={`/days/${date}`} className="font-medium text-accent hover:underline">
          Add notes →
        </Link>
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
