"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

export function TextField({ label, error, hint, type = "text", className, ...rest }: FieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`block w-full rounded-lg border bg-surface px-3 py-2.5 text-base text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 ${
            error ? "border-danger" : "border-line"
          } ${isPassword ? "pr-16" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-muted hover:text-ink"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-base font-semibold text-accent-ink shadow-sm transition hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {message}
    </div>
  );
}
