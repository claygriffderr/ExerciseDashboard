import { hash, verify } from "@node-rs/argon2";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

// Argon2id with the OWASP-recommended baseline: 19 MiB memory, 2 passes, 1 lane.
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id (const enum value from @node-rs/argon2)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed hash must never be treated as a match.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spend the same time as a real check when the email is unknown, so response
 * timing does not reveal which emails have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHash, password);
  return false;
}
