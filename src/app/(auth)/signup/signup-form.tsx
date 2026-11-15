"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthFormState } from "../actions";
import { FormAlert, SubmitButton, TextField } from "@/components/form";

export function SignupForm({ minPasswordLength }: { minPasswordLength: number }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signupAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />
      <TextField
        label="What should we call you?"
        name="displayName"
        autoComplete="given-name"
        required
        maxLength={50}
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={minPasswordLength}
        hint={`At least ${minPasswordLength} characters. A short phrase is easy to remember and hard to guess.`}
        error={state.fieldErrors?.password}
      />
      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
