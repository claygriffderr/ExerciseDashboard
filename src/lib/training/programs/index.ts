import { beginnerOnramp } from "./beginner-onramp";
import { standard531 } from "./standard";
import type { ProgramDefinition } from "./types";

export const PROGRAMS: ProgramDefinition[] = [beginnerOnramp, standard531];

export function getProgram(key: string): ProgramDefinition | undefined {
  return PROGRAMS.find((p) => p.key === key);
}

export type * from "./types";
