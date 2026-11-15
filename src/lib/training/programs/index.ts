import { beginnerOnramp } from "./beginner-onramp";
import { standardBbb } from "./standard-bbb";
import type { ProgramDefinition } from "./types";

export const PROGRAMS: ProgramDefinition[] = [beginnerOnramp, standardBbb];

export function getProgram(key: string): ProgramDefinition | undefined {
  return PROGRAMS.find((p) => p.key === key);
}

export type * from "./types";
