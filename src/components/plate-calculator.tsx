"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ALL_PLATE_SIZES, BAR_OPTIONS, loadOptions, type LoadOption } from "@/lib/training/plates";

type SaveResult = { ok: boolean; error?: string };

const PLATE_STYLE: Record<number, { h: number; w: number; fill: string }> = {
  55: { h: 92, w: 11, fill: "#d64545" },
  45: { h: 92, w: 10, fill: "#3b6fd8" },
  35: { h: 80, w: 9, fill: "#e0b43a" },
  25: { h: 68, w: 8, fill: "#3f9d5d" },
  15: { h: 56, w: 7, fill: "#e8cf5a" },
  10: { h: 50, w: 6, fill: "#8a93a3" },
  5: { h: 40, w: 5, fill: "#5f6878" },
  2.5: { h: 32, w: 4, fill: "#b8bfca" },
  1.25: { h: 26, w: 3.5, fill: "#d3d8df" },
};

const TOLERANCES = [0.025, 0.05, 0.1];

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** A drawn barbell with the plates for one load. */
export function BarbellDiagram({ perSide, className = "" }: { perSide: number[]; className?: string }) {
  const gap = 1.5;
  // Plates stack outward from the collars at x=92 (left) and x=148 (right).
  const sleeveStart = 92;
  const plates: { x: number; plate: number }[] = [];
  let x = sleeveStart;
  for (const plate of perSide) {
    plates.push({ x, plate });
    x += (PLATE_STYLE[plate]?.w ?? 6) + gap;
  }
  const width = 240;
  const cy = 50;
  return (
    <svg viewBox={`0 0 ${width} 100`} className={className} role="img" aria-label={perSide.length ? `Each side: ${perSide.map(fmt).join(", ")} lb` : "Empty bar"}>
      {/* shaft and sleeves */}
      <rect x={30} y={cy - 2.5} width={width - 60} height={5} rx={2} className="fill-muted" />
      {/* collars, just inside the plates */}
      <rect x={sleeveStart} y={cy - 5} width={4} height={10} rx={1} className="fill-muted" />
      <rect x={width - sleeveStart - 4} y={cy - 5} width={4} height={10} rx={1} className="fill-muted" />
      {plates.map(({ x: px, plate }, i) => {
        const s = PLATE_STYLE[plate] ?? { h: 40, w: 6, fill: "#888" };
        return (
          <g key={i}>
            <rect x={sleeveStart - (px - sleeveStart) - s.w} y={cy - s.h / 2} width={s.w} height={s.h} rx={1.5} fill={s.fill} />
            <rect x={width - sleeveStart + (px - sleeveStart)} y={cy - s.h / 2} width={s.w} height={s.h} rx={1.5} fill={s.fill} />
          </g>
        );
      })}
    </svg>
  );
}

export function PlateCalculator({
  initialBar,
  initialPlates,
  save,
}: {
  initialBar: number;
  initialPlates: number[];
  save: (input: { barWeight: number; plates: number[] }) => Promise<SaveResult>;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [tm, setTm] = useState("");
  const [percent, setPercent] = useState("");
  const [tolerance, setTolerance] = useState(0.05);
  const [bar, setBar] = useState(initialBar);
  const [plates, setPlates] = useState<number[]>(initialPlates);
  const [saved, setSaved] = useState({ bar: initialBar, plates: initialPlates });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const targetNum = Number.parseFloat(target);
  const options: LoadOption[] = useMemo(
    () => (targetNum > 0 ? loadOptions(targetNum, bar, plates, tolerance, 8) : []),
    [targetNum, bar, plates, tolerance],
  );
  const best = options[0];
  const dirty = bar !== saved.bar || plates.length !== saved.plates.length || plates.some((p) => !saved.plates.includes(p));

  const applyPercent = (tmValue: string, pctValue: string) => {
    const t = Number.parseFloat(tmValue);
    const p = Number.parseFloat(pctValue);
    if (t > 0 && p > 0) setTarget(fmt(Math.round(t * p) / 100));
  };

  const togglePlate = (p: number) =>
    setPlates((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].sort((a, b) => b - a)));

  const onSave = () =>
    startTransition(async () => {
      const result = await save({ barWeight: bar, plates });
      if (result.ok) {
        setSaved({ bar, plates });
        setMessage("Saved. Your programs will round to these plates.");
      } else {
        setMessage(result.error ?? "Couldn't save.");
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink shadow-lg hover:bg-accent-strong sm:right-6 sm:bottom-6"
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <rect x="1" y="9" width="3" height="6" rx="0.8" fill="currentColor" />
          <rect x="4.5" y="6" width="3" height="12" rx="0.8" fill="currentColor" />
          <rect x="7.5" y="11" width="9" height="2" rx="0.8" fill="currentColor" />
          <rect x="16.5" y="6" width="3" height="12" rx="0.8" fill="currentColor" />
          <rect x="20" y="9" width="3" height="6" rx="0.8" fill="currentColor" />
        </svg>
        Plates
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button type="button" aria-label="Close plate calculator" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-xl font-semibold text-ink">
                  Plate calculator
                </h2>
                <p className="mt-1 text-sm text-muted">Enter a weight to see how to load the bar with the plates you have.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-muted hover:bg-line/40 hover:text-ink" aria-label="Close">
                ✕
              </button>
            </div>

            <label className="mt-5 block text-sm font-medium text-ink" htmlFor={`${titleId}-target`}>
              Target weight (lb)
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" onClick={() => setTarget(fmt(Math.max(0, (targetNum || 0) - 5)))} className="rounded-lg border border-line px-3 py-2.5 text-ink hover:bg-line/40" aria-label="5 lb less">
                −5
              </button>
              <input
                id={`${titleId}-target`}
                type="number"
                inputMode="decimal"
                min={0}
                step={2.5}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 155"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-lg text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button type="button" onClick={() => setTarget(fmt((targetNum || 0) + 5))} className="rounded-lg border border-line px-3 py-2.5 text-ink hover:bg-line/40" aria-label="5 lb more">
                +5
              </button>
            </div>

            <details className="mt-3 rounded-lg border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-ink">Work it out from a percentage</summary>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label="Training max (lb)"
                  placeholder="Training max"
                  value={tm}
                  onChange={(e) => {
                    setTm(e.target.value);
                    applyPercent(e.target.value, percent);
                  }}
                  className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-ink"
                />
                <span className="text-muted">×</span>
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label="Percent"
                  placeholder="%"
                  value={percent}
                  onChange={(e) => {
                    setPercent(e.target.value);
                    applyPercent(tm, e.target.value);
                  }}
                  className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-ink"
                />
                <span className="text-muted">%</span>
              </div>
            </details>

            <div className="mt-5" aria-live="polite">
              {best ? (
                <div className="rounded-xl border border-line p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-3xl font-semibold text-ink">{fmt(best.total)} lb</span>
                    <span className="text-sm text-muted">
                      {best.diff === 0 ? "Exact" : `${best.diff > 0 ? "+" : ""}${fmt(best.diff)} lb from target`}
                    </span>
                  </div>
                  <BarbellDiagram perSide={best.perSide} className="mt-2 w-full" />
                  <p className="text-sm text-ink">
                    <span className="font-medium">Each side:</span>{" "}
                    {best.perSide.length ? best.perSide.map((p) => `${fmt(p)}`).join(" + ") : "nothing, just the bar"}
                  </p>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Your loading will show here.</p>
              )}

              {options.length > 1 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-ink">Other options within ±{tolerance * 100}%</h3>
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {options.slice(1).map((o) => (
                      <li key={o.total} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <button type="button" onClick={() => setTarget(fmt(o.total))} className="font-semibold text-ink hover:text-accent">
                          {fmt(o.total)} lb
                        </button>
                        <span className="text-muted">{o.perSide.length ? o.perSide.map(fmt).join(" + ") : "bar only"}</span>
                        <span className={`w-16 text-right tabular-nums ${o.diff > 0 ? "text-ink" : "text-muted"}`}>
                          {o.diff > 0 ? "+" : ""}
                          {fmt(o.diff)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4 border-t border-line pt-5">
              <div>
                <label className="block text-sm font-medium text-ink" htmlFor={`${titleId}-tol`}>
                  Show options within
                </label>
                <select
                  id={`${titleId}-tol`}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
                >
                  {TOLERANCES.map((t) => (
                    <option key={t} value={t}>
                      ±{t * 100}% of the target
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink" htmlFor={`${titleId}-bar`}>
                  Bar
                </label>
                <select
                  id={`${titleId}-bar`}
                  value={bar}
                  onChange={(e) => setBar(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
                >
                  {BAR_OPTIONS.map((b) => (
                    <option key={b.weight} value={b.weight}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-ink">Plates you have (lb)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_PLATE_SIZES.map((p) => {
                    const on = plates.includes(p);
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
              </fieldset>
              {dirty && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={pending || plates.length === 0}
                  className="w-full rounded-lg border border-accent px-4 py-2 font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save as my equipment"}
                </button>
              )}
              {message && <p className="text-sm text-muted">{message}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
