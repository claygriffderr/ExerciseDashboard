import type { ReactNode } from "react";

export function Badge({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        tone === "accent" ? "bg-accent/15 text-accent-strong" : "bg-line text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/** A large, explained radio option. */
export function ChoiceCard({
  name,
  checked,
  onSelect,
  title,
  badges,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-xl border p-4 transition ${
        checked ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-line bg-surface hover:border-accent/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <input type="radio" name={name} checked={checked} onChange={onSelect} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{title}</span>
            {badges}
          </div>
          {children && <div className="mt-1 text-sm leading-6 text-muted">{children}</div>}
        </div>
      </div>
    </label>
  );
}

export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {children && <div className="mt-2 max-w-2xl leading-7 text-muted">{children}</div>}
    </div>
  );
}

export function InfoBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm leading-6 text-ink">{children}</div>;
}

export function FieldError({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}
