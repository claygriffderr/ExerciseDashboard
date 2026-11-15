import { DEFAULT_GEAR, type Gear } from "./equipment";
import { ALL_PLATE_SIZES } from "./plates";

/** Read the person's equipment from their stored profile, falling back to defaults. */
export function gearFromProfile(profile: { barWeight: number; availablePlates: string } | null): Gear {
  if (!profile) return DEFAULT_GEAR;
  let plates = DEFAULT_GEAR.plates;
  try {
    const parsed: unknown = JSON.parse(profile.availablePlates);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((p): p is number => typeof p === "number" && ALL_PLATE_SIZES.includes(p));
      if (valid.length) plates = valid;
    }
  } catch {
    // Keep defaults if the stored value is unreadable.
  }
  return { ...DEFAULT_GEAR, barWeight: profile.barWeight, plates };
}
