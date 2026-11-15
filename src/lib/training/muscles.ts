export type Muscle =
  | "chest"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "triceps"
  | "biceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "traps"
  | "upper_back"
  | "lats"
  | "lower_back"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "calves";

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  front_delts: "Front shoulders",
  side_delts: "Side shoulders",
  rear_delts: "Rear shoulders",
  triceps: "Triceps",
  biceps: "Biceps",
  forearms: "Forearms and grip",
  abs: "Abs",
  obliques: "Obliques",
  traps: "Traps",
  upper_back: "Upper back",
  lats: "Lats",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  adductors: "Inner thighs",
  calves: "Calves",
};

export const MUSCLE_GROUPS: { label: string; muscles: Muscle[] }[] = [
  { label: "Legs and hips", muscles: ["quads", "hamstrings", "glutes", "adductors", "calves"] },
  { label: "Back", muscles: ["lats", "upper_back", "traps", "lower_back"] },
  { label: "Chest and shoulders", muscles: ["chest", "front_delts", "side_delts", "rear_delts"] },
  { label: "Arms", muscles: ["triceps", "biceps", "forearms"] },
  { label: "Core", muscles: ["abs", "obliques"] },
];
