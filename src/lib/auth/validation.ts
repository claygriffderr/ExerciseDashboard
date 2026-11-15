import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

export const signupSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Tell us what to call you.")
      .max(50, "Please keep your name under 50 characters."),
    email,
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const loginSchema = z.object({
  email,
  // Don't enforce the sign-up rules here; just bound the input size.
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH),
});

export type FieldErrors = Partial<Record<string, string>>;

export function firstErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
