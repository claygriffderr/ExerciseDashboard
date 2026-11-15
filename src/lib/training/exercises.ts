import type { Equipment } from "./equipment";
import type { LiftSlot } from "./five-three-one";
import type { Muscle } from "./muscles";

/**
 * Wendler groups assistance work into three buckets and suggests 50 to 100
 * reps of each per session. "Main" marks lifts that can fill a 5/3/1 slot.
 */
export type MovementPattern = "main" | "push" | "pull" | "legs" | "core";

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  main: "Main lift",
  push: "Push",
  pull: "Pull",
  legs: "Single-leg and legs",
  core: "Core",
};

export type CatalogExercise = {
  slug: string;
  name: string;
  category: "MAIN_LIFT" | "ACCESSORY";
  /** For main lifts: which 5/3/1 slot this exercise can fill. */
  slot?: LiftSlot;
  pattern: MovementPattern;
  equipment: Equipment;
  primary: Muscle[];
  secondary: Muscle[];
  /** Easy to learn and to load lightly. Suggested for the beginner on-ramp. */
  beginnerFriendly: boolean;
  description: string;
  cues: string[];
  /** A safer or simpler way to do it. */
  easier?: string;
};

export const EXERCISES: CatalogExercise[] = [
  // ─── Squat slot ───────────────────────────────────────────────────────────
  {
    slug: "back-squat",
    name: "Back squat",
    category: "MAIN_LIFT",
    slot: "squat",
    pattern: "main",
    equipment: "barbell",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "hamstrings", "lower_back", "abs"],
    beginnerFriendly: false,
    description:
      "The bar rests across your upper back while you sit down between your hips and stand back up. It builds the whole lower body and teaches your trunk to stay braced under load. Set the safety pins in a rack just below your lowest point.",
    cues: [
      "Feet about shoulder-width, toes turned out a little.",
      "Big breath into your belly and brace before each rep.",
      "Push your knees out over your toes as you go down.",
      "Go as deep as you can while your back stays flat; hip crease just below the knee is the usual target.",
      "Drive up through your whole foot, chest and hips rising together.",
    ],
    easier: "Goblet squat or box squat.",
  },
  {
    slug: "goblet-squat",
    name: "Goblet squat",
    category: "MAIN_LIFT",
    slot: "squat",
    pattern: "main",
    equipment: "dumbbell",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "abs", "upper_back"],
    beginnerFriendly: true,
    description:
      "Hold one dumbbell or kettlebell at your chest and squat. The weight in front acts as a counterbalance, which makes it easy to sit upright and find good depth. It's the best way to learn the squat.",
    cues: [
      "Hold the weight against your chest with elbows pointing down.",
      "Sit straight down between your heels, keeping your chest tall.",
      "Let your elbows brush the inside of your knees at the bottom.",
      "Stand up by pushing the floor away.",
    ],
  },
  {
    slug: "box-squat",
    name: "Box squat",
    category: "MAIN_LIFT",
    slot: "squat",
    pattern: "main",
    equipment: "barbell",
    primary: ["glutes", "quads"],
    secondary: ["hamstrings", "adductors", "lower_back"],
    beginnerFriendly: true,
    description:
      "A back squat to a box or bench set at a depth you can reach with good form. The box gives you a consistent target and a safe place to sit if a rep gets hard.",
    cues: [
      "Set the box so the top of your thighs end up about parallel to the floor.",
      "Sit back until you touch the box lightly. Don't crash or relax onto it.",
      "Keep your brace while touching, then drive up.",
    ],
  },

  // ─── Bench slot ───────────────────────────────────────────────────────────
  {
    slug: "bench-press",
    name: "Bench press",
    category: "MAIN_LIFT",
    slot: "bench",
    pattern: "main",
    equipment: "barbell",
    primary: ["chest", "triceps"],
    secondary: ["front_delts"],
    beginnerFriendly: false,
    description:
      "Lying on a bench, lower the bar to your lower chest and press it back up. It's the main upper-body pressing strength builder. Use safety arms or a spotter.",
    cues: [
      "Eyes under the bar, feet flat and planted.",
      "Squeeze your shoulder blades together and down; keep them there.",
      "Grip a little wider than shoulder-width, wrists stacked over elbows.",
      "Lower under control to the lower chest, elbows at roughly 45 degrees.",
      "Press up and slightly back toward your face.",
    ],
    easier: "Dumbbell bench press.",
  },
  {
    slug: "dumbbell-bench-press",
    name: "Dumbbell bench press",
    category: "MAIN_LIFT",
    slot: "bench",
    pattern: "main",
    equipment: "dumbbell",
    primary: ["chest", "triceps"],
    secondary: ["front_delts"],
    beginnerFriendly: true,
    description:
      "The bench press with a dumbbell in each hand. Each arm works on its own, it's easy on the shoulders, and if a rep fails you can simply lower the weights to your sides. Weights are per hand.",
    cues: [
      "Sit with the dumbbells on your thighs, then lie back and bring them up together.",
      "Shoulder blades pulled back and down, feet planted.",
      "Lower until the dumbbells are beside your chest.",
      "Press up until your arms are straight, dumbbells over your shoulders.",
    ],
  },

  // ─── Deadlift slot ────────────────────────────────────────────────────────
  {
    slug: "deadlift",
    name: "Deadlift",
    category: "MAIN_LIFT",
    slot: "deadlift",
    pattern: "main",
    equipment: "barbell",
    primary: ["glutes", "hamstrings", "lower_back"],
    secondary: ["quads", "traps", "upper_back", "forearms", "lats"],
    beginnerFriendly: false,
    description:
      "Lift a loaded bar from the floor to standing by driving your hips forward. It trains the entire back of the body plus grip, and it carries over directly to lifting things safely in daily life.",
    cues: [
      "Bar over the middle of your foot, shins close to it.",
      "Hinge down and grip just outside your legs.",
      "Pull the slack out of the bar and tighten your back before it leaves the floor.",
      "Push the floor away; keep the bar touching your legs.",
      "Stand tall with hips through. Don't lean back.",
    ],
    easier: "Trap bar deadlift or kettlebell deadlift.",
  },
  {
    slug: "trap-bar-deadlift",
    name: "Trap bar deadlift",
    category: "MAIN_LIFT",
    slot: "deadlift",
    pattern: "main",
    equipment: "barbell",
    primary: ["glutes", "quads", "hamstrings"],
    secondary: ["lower_back", "traps", "forearms"],
    beginnerFriendly: true,
    description:
      "A deadlift using a hexagon-shaped bar that you stand inside. The weight sits in line with your body, so it's easier to keep a flat back and it puts less stress on the lower back than a straight bar.",
    cues: [
      "Stand in the center of the bar, handles beside your ankles.",
      "Hinge and bend your knees to grip the handles.",
      "Chest up, back flat, then stand up by pushing the floor away.",
      "Lower by reversing the same path.",
    ],
  },
  {
    slug: "kettlebell-deadlift",
    name: "Kettlebell deadlift",
    category: "MAIN_LIFT",
    slot: "deadlift",
    pattern: "main",
    equipment: "kettlebell",
    primary: ["glutes", "hamstrings"],
    secondary: ["lower_back", "quads", "forearms"],
    beginnerFriendly: true,
    description:
      "Deadlift a kettlebell placed between your feet. It's the simplest way to learn the hip hinge, the movement behind safe lifting from the floor.",
    cues: [
      "Kettlebell between your feet, in line with your ankles.",
      "Push your hips back as if closing a car door with your backside.",
      "Grab the handle with a flat back, then stand up tall.",
      "Lower by pushing your hips back first.",
    ],
  },

  // ─── Press slot ───────────────────────────────────────────────────────────
  {
    slug: "overhead-press",
    name: "Overhead press",
    category: "MAIN_LIFT",
    slot: "press",
    pattern: "main",
    equipment: "barbell",
    primary: ["front_delts", "triceps"],
    secondary: ["side_delts", "traps", "abs", "upper_back"],
    beginnerFriendly: false,
    description:
      "Standing, press the bar from your shoulders to overhead. It builds strong, healthy shoulders and a stable trunk, since your whole body has to stay rigid.",
    cues: [
      "Bar resting on the front of your shoulders, grip just outside them.",
      "Squeeze your glutes and brace your abs so you don't lean back.",
      "Move your head back slightly and press straight up.",
      "Once the bar passes your forehead, push your head through so the bar ends over your mid-foot.",
    ],
    easier: "Seated dumbbell shoulder press.",
  },
  {
    slug: "dumbbell-shoulder-press",
    name: "Dumbbell shoulder press",
    category: "MAIN_LIFT",
    slot: "press",
    pattern: "main",
    equipment: "dumbbell",
    primary: ["front_delts", "triceps"],
    secondary: ["side_delts", "traps"],
    beginnerFriendly: true,
    description:
      "Press a dumbbell in each hand from shoulder height to overhead, seated with back support or standing. A shoulder-friendly way to train the press. Weights are per hand.",
    cues: [
      "Dumbbells at shoulder height, palms facing forward or slightly in.",
      "Ribs down, abs braced; don't arch your lower back.",
      "Press up until your arms are straight.",
      "Lower under control to shoulder height.",
    ],
  },

  // ─── Pull ─────────────────────────────────────────────────────────────────
  {
    slug: "chin-up",
    name: "Chin-up",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "bodyweight",
    primary: ["lats", "biceps"],
    secondary: ["upper_back", "forearms", "abs"],
    beginnerFriendly: false,
    description:
      "Hang from a bar with palms facing you and pull your chin over it. One of the best upper-back and arm builders.",
    cues: [
      "Start from a full hang with arms straight.",
      "Pull your elbows down toward your ribs.",
      "Chin over the bar, then lower all the way under control.",
    ],
    easier: "Lat pulldown, or band-assisted chin-ups.",
  },
  {
    slug: "lat-pulldown",
    name: "Lat pulldown",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "cable",
    primary: ["lats"],
    secondary: ["biceps", "upper_back", "rear_delts"],
    beginnerFriendly: true,
    description: "Seated at a cable machine, pull a bar down to your upper chest. Trains the same muscles as a chin-up at any load.",
    cues: [
      "Thighs locked under the pad, grip slightly wider than shoulders.",
      "Lean back slightly and pull the bar to your upper chest.",
      "Think of driving your elbows down into your back pockets.",
      "Let the bar rise slowly until your arms are straight.",
    ],
  },
  {
    slug: "dumbbell-row",
    name: "One-arm dumbbell row",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "dumbbell",
    primary: ["lats", "upper_back"],
    secondary: ["biceps", "rear_delts", "forearms"],
    beginnerFriendly: true,
    description: "With one hand and knee on a bench, row a dumbbell up to your hip. Builds the back and balances out all the pressing.",
    cues: [
      "Back flat and roughly parallel to the floor.",
      "Pull the dumbbell toward your hip, not your chest.",
      "Pause at the top, then lower until your arm is straight.",
    ],
  },
  {
    slug: "seated-cable-row",
    name: "Seated cable row",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "cable",
    primary: ["upper_back", "lats"],
    secondary: ["biceps", "rear_delts", "lower_back"],
    beginnerFriendly: true,
    description: "Seated with feet braced, pull a cable handle to your stomach.",
    cues: [
      "Sit tall with a slight bend in your knees.",
      "Pull the handle to your belly button, squeezing your shoulder blades together.",
      "Return slowly without rounding forward.",
    ],
  },
  {
    slug: "inverted-row",
    name: "Inverted row",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "bodyweight",
    primary: ["upper_back", "lats"],
    secondary: ["biceps", "rear_delts", "abs"],
    beginnerFriendly: true,
    description:
      "Lie under a bar set in a rack and pull your chest up to it, body straight like a plank. Raise the bar to make it easier.",
    cues: [
      "Body in a straight line from heels to head.",
      "Pull your chest to the bar.",
      "Lower until your arms are straight.",
    ],
  },
  {
    slug: "face-pull",
    name: "Face pull",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "cable",
    primary: ["rear_delts", "upper_back"],
    secondary: ["traps"],
    beginnerFriendly: true,
    description: "Pull a rope attachment toward your face with elbows high. Great for shoulder health and posture.",
    cues: [
      "Cable set at about face height, rope held with thumbs toward you.",
      "Pull toward your forehead, separating the rope ends.",
      "Finish with elbows high and hands beside your ears.",
    ],
  },

  // ─── Push ─────────────────────────────────────────────────────────────────
  {
    slug: "push-up",
    name: "Push-up",
    category: "ACCESSORY",
    pattern: "push",
    equipment: "bodyweight",
    primary: ["chest", "triceps"],
    secondary: ["front_delts", "abs"],
    beginnerFriendly: true,
    description: "The classic. Hands on the floor, or on a bench or wall to make it easier.",
    cues: [
      "Hands a little wider than shoulders, body in a straight line.",
      "Lower your chest toward the floor with elbows angled back, not flared out.",
      "Push the floor away until your arms are straight.",
    ],
    easier: "Hands on a bench, counter or wall.",
  },
  {
    slug: "dip",
    name: "Dip",
    category: "ACCESSORY",
    pattern: "push",
    equipment: "bodyweight",
    primary: ["triceps", "chest"],
    secondary: ["front_delts"],
    beginnerFriendly: false,
    description: "Support yourself on parallel bars and lower your body by bending your elbows, then press back up.",
    cues: [
      "Start with arms straight, shoulders down away from your ears.",
      "Lower until your upper arms are about parallel to the floor, or less if your shoulders complain.",
      "Press back up to straight arms.",
    ],
    easier: "Bench dips with feet on the floor, or push-ups.",
  },
  {
    slug: "incline-dumbbell-press",
    name: "Incline dumbbell press",
    category: "ACCESSORY",
    pattern: "push",
    equipment: "dumbbell",
    primary: ["chest", "front_delts"],
    secondary: ["triceps"],
    beginnerFriendly: true,
    description: "A dumbbell press on a bench set at about 30 degrees. Emphasizes the upper chest and shoulders.",
    cues: [
      "Bench at a low incline, about 30 degrees.",
      "Lower the dumbbells beside your upper chest.",
      "Press up and slightly together.",
    ],
  },
  {
    slug: "triceps-pushdown",
    name: "Triceps pushdown",
    category: "ACCESSORY",
    pattern: "push",
    equipment: "cable",
    primary: ["triceps"],
    secondary: [],
    beginnerFriendly: true,
    description: "Push a cable bar or rope down by straightening your elbows. Isolates the triceps that drive your presses.",
    cues: [
      "Elbows pinned to your sides.",
      "Straighten your arms fully, then let them come up to about 90 degrees.",
    ],
  },
  {
    slug: "lateral-raise",
    name: "Lateral raise",
    category: "ACCESSORY",
    pattern: "push",
    equipment: "dumbbell",
    primary: ["side_delts"],
    secondary: ["traps"],
    beginnerFriendly: true,
    description: "Raise light dumbbells out to your sides to shoulder height. Builds the sides of the shoulders.",
    cues: [
      "Slight bend in your elbows, lead with your elbows.",
      "Raise to shoulder height, no higher.",
      "Lower slowly; light weights are plenty.",
    ],
  },

  // ─── Legs ─────────────────────────────────────────────────────────────────
  {
    slug: "walking-lunge",
    name: "Walking lunge",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "dumbbell",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "hamstrings", "calves"],
    beginnerFriendly: false,
    description: "Step forward into a lunge, then bring the back foot through into the next step. Builds single-leg strength and balance.",
    cues: [
      "Take a long enough step that your front shin stays roughly vertical.",
      "Lower your back knee toward the floor under control.",
      "Push through the front foot to step through.",
    ],
    easier: "Split squat in place, holding a support.",
  },
  {
    slug: "split-squat",
    name: "Split squat",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "dumbbell",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "hamstrings"],
    beginnerFriendly: true,
    description:
      "A stationary lunge: one foot forward, one back, lower straight down and up. Hold a wall or rack for balance if needed.",
    cues: [
      "Stagger your feet about hip-width apart side to side.",
      "Drop your back knee straight down toward the floor.",
      "Drive up through the front heel.",
    ],
  },
  {
    slug: "step-up",
    name: "Step-up",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "dumbbell",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "calves"],
    beginnerFriendly: true,
    description: "Step up onto a box or sturdy step and stand tall, then step back down. Very practical for stairs and daily life.",
    cues: [
      "Whole front foot on the box.",
      "Lean slightly forward and push through the box foot, not the floor foot.",
      "Step down slowly.",
    ],
  },
  {
    slug: "leg-press",
    name: "Leg press",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "machine",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "hamstrings"],
    beginnerFriendly: true,
    description: "Push a weighted sled away with your legs while seated. Lets you train the legs hard with no balance demands.",
    cues: [
      "Feet shoulder-width in the middle of the platform.",
      "Lower until your knees are around 90 degrees, without your lower back peeling off the seat.",
      "Press back up without locking your knees hard.",
    ],
  },
  {
    slug: "leg-curl",
    name: "Leg curl",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "machine",
    primary: ["hamstrings"],
    secondary: ["calves"],
    beginnerFriendly: true,
    description: "Curl a padded lever toward your backside on a machine. Isolates the hamstrings.",
    cues: ["Line your knees up with the machine's pivot.", "Curl all the way, then lower slowly."],
  },
  {
    slug: "glute-bridge",
    name: "Glute bridge",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "bodyweight",
    primary: ["glutes"],
    secondary: ["hamstrings", "abs"],
    beginnerFriendly: true,
    description: "Lying on your back with knees bent, drive your hips up toward the ceiling. Add a weight across your hips to progress.",
    cues: [
      "Feet flat, heels about a hand's length from your backside.",
      "Squeeze your glutes to lift your hips until your body is straight from knees to shoulders.",
      "Pause at the top, then lower.",
    ],
  },
  {
    slug: "back-extension",
    name: "Back extension",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "bodyweight",
    primary: ["lower_back", "glutes"],
    secondary: ["hamstrings"],
    beginnerFriendly: true,
    description: "On a back-extension bench, hinge forward at the hips and come back up to a straight line.",
    cues: [
      "Pad just below your hip bones.",
      "Hinge down with a flat back, then squeeze your glutes to come up.",
      "Stop when your body is straight. Don't arch past it.",
    ],
  },
  {
    slug: "kettlebell-swing",
    name: "Kettlebell swing",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "kettlebell",
    primary: ["glutes", "hamstrings"],
    secondary: ["lower_back", "abs", "forearms"],
    beginnerFriendly: false,
    description:
      "Hike a kettlebell back between your legs and snap your hips forward to swing it to chest height. Builds powerful hips and conditioning.",
    cues: [
      "It's a hinge, not a squat: hips go back, shins stay fairly vertical.",
      "Snap your hips forward and squeeze your glutes. Your arms just guide the bell.",
      "Let the bell fall back between your legs before the next rep.",
    ],
    easier: "Kettlebell deadlift.",
  },
  {
    slug: "calf-raise",
    name: "Calf raise",
    category: "ACCESSORY",
    pattern: "legs",
    equipment: "bodyweight",
    primary: ["calves"],
    secondary: [],
    beginnerFriendly: true,
    description: "Rise up onto your toes and lower back down, ideally with your heels hanging off a step.",
    cues: ["Rise as high as you can and pause.", "Lower slowly until you feel a stretch."],
  },

  // ─── Core ─────────────────────────────────────────────────────────────────
  {
    slug: "hanging-leg-raise",
    name: "Hanging leg raise",
    category: "ACCESSORY",
    pattern: "core",
    equipment: "bodyweight",
    primary: ["abs"],
    secondary: ["obliques", "forearms"],
    beginnerFriendly: false,
    description: "Hang from a bar and raise your legs in front of you. Bend your knees to make it easier.",
    cues: [
      "Start from a still hang. Don't swing.",
      "Curl your pelvis up as you raise your legs.",
      "Lower slowly.",
    ],
    easier: "Knee raises, or dead bugs on the floor.",
  },
  {
    slug: "dead-bug",
    name: "Dead bug",
    category: "ACCESSORY",
    pattern: "core",
    equipment: "bodyweight",
    primary: ["abs"],
    secondary: ["obliques"],
    beginnerFriendly: true,
    description:
      "Lying on your back with arms and knees up, slowly lower the opposite arm and leg while keeping your lower back on the floor. Teaches the brace used in every lift.",
    cues: [
      "Press your lower back gently into the floor and keep it there.",
      "Breathe out as you extend the opposite arm and leg.",
      "Go slowly; one rep is one side.",
    ],
  },
  {
    slug: "ab-wheel",
    name: "Ab wheel rollout",
    category: "ACCESSORY",
    pattern: "core",
    equipment: "bodyweight",
    primary: ["abs"],
    secondary: ["lats", "obliques"],
    beginnerFriendly: false,
    description: "From your knees, roll an ab wheel forward as far as you can control and pull it back.",
    cues: [
      "Squeeze your glutes and tuck your ribs down.",
      "Roll out only as far as you can without your lower back sagging.",
    ],
    easier: "Dead bug.",
  },
  {
    slug: "pallof-press",
    name: "Pallof press",
    category: "ACCESSORY",
    pattern: "core",
    equipment: "cable",
    primary: ["obliques", "abs"],
    secondary: [],
    beginnerFriendly: true,
    description: "Standing side-on to a cable or band, press the handle straight out and resist being twisted.",
    cues: [
      "Feet shoulder-width, handle at your chest.",
      "Press straight out and hold for a second without rotating.",
      "Bring it back in slowly. Do both sides.",
    ],
  },

  // ─── Arms ─────────────────────────────────────────────────────────────────
  {
    slug: "dumbbell-curl",
    name: "Dumbbell curl",
    category: "ACCESSORY",
    pattern: "pull",
    equipment: "dumbbell",
    primary: ["biceps"],
    secondary: ["forearms"],
    beginnerFriendly: true,
    description: "Curl a dumbbell in each hand from your sides up to your shoulders.",
    cues: ["Elbows stay by your sides.", "Lift without swinging, lower slowly."],
  },
];

export const EXERCISE_BY_SLUG = new Map(EXERCISES.map((e) => [e.slug, e]));

export function getExercise(slug: string): CatalogExercise {
  const e = EXERCISE_BY_SLUG.get(slug);
  if (!e) throw new Error(`Unknown exercise: ${slug}`);
  return e;
}

/** Exercises that can fill a main-lift slot, standard choice first. */
export function slotVariants(slot: LiftSlot): CatalogExercise[] {
  return EXERCISES.filter((e) => e.slot === slot);
}
