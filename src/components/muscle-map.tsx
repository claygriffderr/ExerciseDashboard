import type { Muscle } from "@/lib/training/muscles";

type Shape = { muscle?: Muscle; d?: string; ellipse?: [number, number, number, number]; rect?: [number, number, number, number, number] };

/** Mirror a shape list around a vertical center line. */
function mirror(shapes: Shape[], cx: number): Shape[] {
  return shapes.map((s) => {
    if (s.ellipse) {
      const [x, y, rx, ry] = s.ellipse;
      return { ...s, ellipse: [2 * cx - x, y, rx, ry] };
    }
    if (s.rect) {
      const [x, y, w, h, r] = s.rect;
      return { ...s, rect: [2 * cx - x - w, y, w, h, r] };
    }
    if (s.d) {
      // Mirror absolute "x,y" pairs in simple M/L/Q/Z paths.
      return { ...s, d: s.d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${2 * cx - Number(x)},${y}`) };
    }
    return s;
  });
}

const FRONT_CX = 60;
const BACK_CX = 180;

// Left half of the front figure; the right half is mirrored.
const FRONT_HALF: Shape[] = [
  { muscle: "front_delts", ellipse: [37, 51, 8.5, 10] },
  { muscle: "side_delts", ellipse: [30.5, 56, 3.5, 8] },
  { muscle: "chest", d: "M43,46 Q52,43 59,47 L59,64 Q50,69 43,62 Z" },
  { muscle: "biceps", ellipse: [31, 76, 5.5, 12.5] },
  { muscle: "forearms", ellipse: [27.5, 103, 4.8, 13.5] },
  { muscle: "obliques", d: "M43,67 Q48,70 50.5,72 L50.5,104 Q45,102 42,95 Z" },
  { muscle: "quads", ellipse: [49, 151, 9.5, 25] },
  { muscle: "adductors", ellipse: [56.5, 137, 3, 12] },
];

const BACK_HALF: Shape[] = [
  { muscle: "rear_delts", ellipse: [157, 51, 8.5, 10] },
  { muscle: "upper_back", d: "M165,50 L177,56 L177,73 L164,69 Z" },
  { muscle: "lats", d: "M161,63 L177,77 L177,99 Q167,96 162,84 Z" },
  { muscle: "triceps", ellipse: [151, 76, 5.5, 12.5] },
  { muscle: "forearms", ellipse: [147.5, 103, 4.8, 13.5] },
  { muscle: "glutes", ellipse: [171, 126, 10.5, 12] },
  { muscle: "hamstrings", ellipse: [170, 158, 8.5, 21] },
  { muscle: "calves", ellipse: [170, 204, 6.5, 15] },
];

const FRONT: Shape[] = [
  ...FRONT_HALF,
  ...mirror(FRONT_HALF, FRONT_CX),
  { muscle: "traps", d: "M48,41 L54,36 L66,36 L72,41 Q60,43 48,41 Z" },
  { muscle: "abs", rect: [51.5, 67, 17, 41, 5] },
];

const BACK: Shape[] = [
  ...BACK_HALF,
  ...mirror(BACK_HALF, BACK_CX),
  { muscle: "traps", d: "M167,39 L180,34 L193,39 L186,62 L180,67 L174,62 Z" },
  { muscle: "lower_back", rect: [173, 97, 14, 15, 4] },
];

/** Silhouette pieces drawn underneath the muscles. */
function silhouette(cx: number): string[] {
  const o = cx - 60;
  const p = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${Number(x) + o},${y}`);
  return [
    // head and neck
    p("M60,6 Q72,6 72,21 Q72,34 60,35 Q48,34 48,21 Q48,6 60,6 Z"),
    p("M54,32 L66,32 L67,40 L53,40 Z"),
    // torso
    p("M40,42 Q60,37 80,42 L82,60 L79,112 L81,124 L39,124 L41,112 L38,60 Z"),
    // arms
    p("M29,44 Q37,40 42,46 L37,90 L33,118 L22,118 L22,90 Z"),
    p("M91,44 Q83,40 78,46 L83,90 L87,118 L98,118 L98,90 Z"),
    // hands
    p("M21,117 L34,117 L32,130 L23,130 Z"),
    p("M99,117 L86,117 L88,130 L97,130 Z"),
    // legs
    p("M39,120 L59,124 L58,182 L56,226 L44,226 L41,182 Z"),
    p("M81,120 L61,124 L62,182 L64,226 L76,226 L79,182 Z"),
    // feet
    p("M43,224 L57,224 L59,234 L40,234 Z"),
    p("M77,224 L63,224 L61,234 L80,234 Z"),
  ];
}

function drawShape(s: Shape, className: string, key: number) {
  if (s.ellipse) {
    const [cx, cy, rx, ry] = s.ellipse;
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} className={className} />;
  }
  if (s.rect) {
    const [x, y, w, h, r] = s.rect;
    return <rect key={key} x={x} y={y} width={w} height={h} rx={r} className={className} />;
  }
  return <path key={key} d={s.d} className={className} />;
}

export function MuscleMap({
  primary,
  secondary = [],
  className = "",
  title,
}: {
  primary: Muscle[];
  secondary?: Muscle[];
  className?: string;
  title?: string;
}) {
  const p = new Set(primary);
  const s = new Set(secondary);
  const tone = (m?: Muscle) =>
    m && p.has(m) ? "fill-accent" : m && s.has(m) ? "fill-accent/40" : "fill-[var(--muscle-idle)]";

  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-label={title ?? "Muscles worked"}>
      {[FRONT_CX, BACK_CX].map((cx) => (
        <g key={cx}>
          {silhouette(cx).map((d, i) => (
            <path key={i} d={d} className="fill-[var(--body)]" />
          ))}
        </g>
      ))}
      {FRONT.map((shape, i) => drawShape(shape, tone(shape.muscle), i))}
      {BACK.map((shape, i) => drawShape(shape, tone(shape.muscle), i + 100))}
      <text x={FRONT_CX} y={239} textAnchor="middle" className="fill-muted text-[9px]">
        Front
      </text>
      <text x={BACK_CX} y={239} textAnchor="middle" className="fill-muted text-[9px]">
        Back
      </text>
    </svg>
  );
}

export function MuscleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-accent" /> Main muscles
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-accent/40" /> Also working
      </span>
    </div>
  );
}
