"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  formatClock,
  formatDuration,
  REST_CHOICES,
  REST_KEYS,
  REST_LABELS,
  type RestKey,
  type RestSettings,
  type Section,
} from "@/lib/log/rest";
import { saveRestSettings } from "../../actions";

// ─── Timer state ────────────────────────────────────────────────────────────

export type RunningRest = {
  /** The exercise card the timer shows under. */
  exerciseKey: string;
  /** The set whose tick started it; unticking that set stops it. */
  setKey: string;
  label: string;
  total: number;
  endsAt: number;
};

const storageKey = (workoutId: string) => `rest-timer:${workoutId}`;

// The running timer lives in localStorage, so it survives a reload or a locked
// phone (it counts to a clock time). A copy in memory covers blocked storage.
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

function readStored(key: string): string | null {
  let raw: string | null;
  if (memory.has(key)) raw = memory.get(key) ?? null;
  else {
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    memory.set(key, raw);
  }
  return raw;
}

function writeStored(key: string, value: string | null) {
  memory.set(key, value);
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage can be blocked; the timer still works for this visit.
  }
  listeners.forEach((fn) => fn());
}

function parseRest(raw: string | null): RunningRest | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as RunningRest;
    const ok = typeof r?.endsAt === "number" && typeof r.total === "number" && typeof r.exerciseKey === "string";
    return ok ? r : null;
  } catch {
    return null;
  }
}

/** One rest timer per workout page. */
export function useRestTimer(workoutId: string) {
  const key = storageKey(workoutId);
  const raw = useSyncExternalStore(subscribe, () => readStored(key), () => null);
  const parsed = useMemo(() => parseRest(raw), [raw]);
  // A timer that ran out more than ten minutes before the page opened is old news.
  const [openedAt] = useState(() => Date.now());
  const rest = parsed && parsed.endsAt > openedAt - 10 * 60_000 ? parsed : null;
  const persist = (next: RunningRest | null) => writeStored(key, next ? JSON.stringify(next) : null);

  return {
    rest,
    start: (r: Omit<RunningRest, "endsAt">) => persist({ ...r, endsAt: Date.now() + r.total * 1000 }),
    extend: (seconds: number) =>
      rest && persist({ ...rest, total: rest.total + seconds, endsAt: Math.max(rest.endsAt, Date.now()) + seconds * 1000 }),
    clear: () => persist(null),
  };
}

/** The current time, ticking until `until` has passed. */
function useNow(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    };
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [until]);
  return now;
}

// ─── The countdown under an exercise ────────────────────────────────────────

export function RestCountdown({ rest, onExtend, onHide }: { rest: RunningRest; onExtend: () => void; onHide: () => void }) {
  const now = useNow(rest.endsAt);
  const left = (rest.endsAt - now) / 1000;
  const finished = left <= 0;
  const elapsed = Math.min(1, Math.max(0, 1 - left / rest.total));

  return (
    <div
      className={`mt-4 rounded-xl border px-3.5 py-3 transition-colors duration-700 ${
        finished ? "border-success/50 bg-success/10" : "border-line bg-background"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{finished ? `${rest.label} · whenever you're ready` : `Rest · ${rest.label}`}</p>
          <p role="timer" aria-live="off" className={`text-2xl font-semibold tabular-nums ${finished ? "text-success" : "text-ink"}`}>
            {finished ? (
              <>
                <span aria-hidden>✓ </span>Rested {formatDuration(rest.total)}
              </>
            ) : (
              formatClock(left)
            )}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          {!finished && (
            <button type="button" onClick={onExtend} className="font-medium text-accent hover:underline">
              +30 s
            </button>
          )}
          <button type="button" onClick={onHide} className="font-medium text-muted hover:text-ink">
            Hide
          </button>
        </div>
      </div>
      {!finished && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-accent/70" style={{ width: `${elapsed * 100}%` }} />
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {finished ? "Rest time is up." : ""}
      </span>
    </div>
  );
}

// ─── Settings, shown with the session's guidance ────────────────────────────

const SHORT: Record<RestKey, string> = {
  WARMUP: "Warm-up",
  MAIN: "Main",
  SUPPLEMENTAL: "Volume",
  ACCESSORY: "Assistance",
  BETWEEN: "Between exercises",
};

export function RestSettingsPanel({
  settings,
  sections,
  onChange,
}: {
  settings: RestSettings;
  /** Sections in this workout, so only the relevant times show. */
  sections: Section[];
  onChange: (s: RestSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const keys = REST_KEYS.filter((k) => k === "BETWEEN" || sections.includes(k));

  const update = (next: RestSettings) => {
    onChange(next);
    startTransition(async () => {
      const result = await saveRestSettings(next);
      setError(result.ok ? null : (result.error ?? "Couldn't save your rest times."));
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p id="rest-title" className="font-medium text-ink">
          Rest timer
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-labelledby="rest-title"
          onClick={() => update({ ...settings, enabled: !settings.enabled })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.enabled ? "bg-accent" : "bg-line"}`}
        >
          <span
            aria-hidden
            className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              settings.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      <p id="rest-summary" className="mt-1 text-muted">
        {settings.enabled ? (
          <>
            {keys.map((k) => `${SHORT[k]} ${formatDuration(settings.seconds[k])}`).join(" · ")}{" "}
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="ml-1 font-medium text-accent hover:underline">
              {open ? "Done" : "Change times"}
            </button>
          </>
        ) : (
          "Off. Turn it on to time your breaks after each set."
        )}
      </p>

      {open && settings.enabled && (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map((k) => (
              <label key={k} className="block">
                <span className="text-muted">{REST_LABELS[k]}</span>
                <select
                  value={settings.seconds[k]}
                  onChange={(e) => update({ ...settings, seconds: { ...settings.seconds, [k]: Number(e.target.value) } })}
                  className="mt-1 block w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                >
                  {[...new Set([...REST_CHOICES, settings.seconds[k]])]
                    .sort((a, b) => a - b)
                    .map((s) => (
                      <option key={s} value={s}>
                        {formatDuration(s)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            The timer starts when you tick a set and turns green when the time is up. It&apos;s only a guide, so go
            whenever you feel ready. Wendler doesn&apos;t set rest times for 5/3/1; most lifters rest 1½ to 3 minutes,
            with less for warm-ups, volume and assistance work. Your times are saved for every workout.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
