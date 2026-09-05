/** Which exercises have a demonstration to show, and where its frames live.
 *
 *  Keyed by the canonical English exercise name, like the display and alias
 *  dictionaries — the name in the database is the stable identity, and the
 *  demo is display-only.
 *
 *  Every pairing here was checked by eye against the source artwork, not by
 *  name: the source has a dozen near-namesakes per movement and its names don't
 *  always describe the picture. A plausible-looking wrong demo teaches the wrong
 *  movement, which is worse than no demo at all — so where the source had no
 *  honest match (hip thrust, push press, belt and pendulum squat, landmine row,
 *  seated leg press, standing leg curl, clean and jerk, snatch) the exercise is
 *  simply absent and the button doesn't appear.
 *
 *  Variants inherit their parent's demo through `variantOfName`, so these ~136
 *  entries cover the whole catalog bar those gaps.
 *
 *  Artwork is vendored from ExerciseGymGifsDB by scripts/import-exercise-gifs.mjs;
 *  which source GIF each slug came from is recorded in the imported
 *  SOURCES.json. */

/** Slug of the imported demo, per canonical exercise name. */
const DEMOS: Record<string, string> = {
  // ── Chest ───────────────────────────────────────────────────────────────
  'Bench Press': 'bench-press',
  'Incline Bench Press': 'incline-bench-press',
  'Decline Bench Press': 'decline-bench-press',
  'Smith Machine Bench Press': 'smith-machine-bench-press',
  'Smith Machine Incline Press': 'smith-machine-incline-press',
  'Smith Machine Decline Press': 'smith-machine-decline-press',
  'Dumbbell Bench Press': 'dumbbell-bench-press',
  'Incline Dumbbell Press': 'incline-dumbbell-press',
  'Decline Dumbbell Press': 'decline-dumbbell-press',
  'Machine Chest Press': 'machine-chest-press',
  'Incline Machine Chest Press': 'incline-machine-chest-press',
  'Decline Machine Chest Press': 'decline-machine-chest-press',
  'Plate-Loaded Chest Press': 'machine-chest-press',
  'Plate-Loaded Incline Chest Press': 'incline-machine-chest-press',
  'Plate-Loaded Decline Chest Press': 'decline-machine-chest-press',
  'Chest Fly': 'chest-fly',
  'Incline Chest Fly': 'incline-chest-fly',
  'Cable Fly': 'cable-fly',
  'Incline Cable Fly': 'incline-cable-fly',
  'Pec Deck': 'pec-deck',
  'Push-Up': 'push-up',
  Dip: 'dip',
  'Incline Push-Up': 'incline-push-up',
  'Decline Push-Up': 'decline-push-up',

  // ── Back ────────────────────────────────────────────────────────────────
  Deadlift: 'deadlift',
  'Rack Pull': 'rack-pull',
  'Barbell Row': 'barbell-row',
  'Pendlay Row': 'pendlay-row',
  'Smith Machine Row': 'smith-machine-row',
  'Dumbbell Row': 'dumbbell-row',
  'T-Bar Row': 't-bar-row',
  'Chest Supported Row': 'chest-supported-row',
  'Chest-Supported Dumbbell Row': 'chest-supported-dumbbell-row',
  'Machine Row': 'machine-row',
  'Plate-Loaded Row': 'plate-loaded-row',
  'Seated Cable Row': 'seated-cable-row',
  'Lat Pulldown': 'lat-pulldown',
  'Machine Lat Pulldown': 'machine-lat-pulldown',
  'Plate-Loaded Lat Pulldown': 'machine-lat-pulldown',
  'Straight-Arm Pulldown': 'straight-arm-pulldown',
  'Pull-Up': 'pull-up',
  'Assisted Pull-Up': 'assisted-pull-up',
  'Inverted Row': 'inverted-row',
  Pullover: 'pullover',
  'Cable Pullover': 'cable-pullover',
  'Back Extension': 'back-extension',
  'Good Morning': 'good-morning',

  // ── Shoulders ───────────────────────────────────────────────────────────
  'Overhead Press': 'overhead-press',
  'Seated Barbell Press': 'seated-barbell-press',
  'Smith Machine Shoulder Press': 'smith-machine-shoulder-press',
  'Landmine Press': 'landmine-press',
  'Seated Dumbbell Press': 'seated-dumbbell-press',
  'Machine Shoulder Press': 'machine-shoulder-press',
  'Plate-Loaded Shoulder Press': 'plate-loaded-shoulder-press',
  'Lateral Raise': 'lateral-raise',
  'Cable Lateral Raise': 'cable-lateral-raise',
  'Machine Lateral Raise': 'machine-lateral-raise',
  'Front Raise': 'front-raise',
  'Cable Front Raise': 'cable-front-raise',
  'Rear Delt Fly': 'rear-delt-fly',
  'Cable Reverse Fly': 'cable-reverse-fly',
  'Reverse Pec Deck': 'reverse-pec-deck',
  'Face Pull': 'face-pull',
  'Barbell Shrug': 'barbell-shrug',
  'Dumbbell Shrug': 'dumbbell-shrug',
  'Upright Row': 'upright-row',
  'Cable Upright Row': 'cable-upright-row',

  // ── Arms ────────────────────────────────────────────────────────────────
  'Barbell Curl': 'barbell-curl',
  'EZ Bar Curl': 'ez-bar-curl',
  'Bicep Curl': 'bicep-curl',
  'Incline Dumbbell Curl': 'incline-dumbbell-curl',
  'Concentration Curl': 'concentration-curl',
  'Spider Curl': 'spider-curl',
  'Preacher Curl': 'preacher-curl',
  'Dumbbell Preacher Curl': 'dumbbell-preacher-curl',
  'Machine Preacher Curl': 'machine-preacher-curl',
  'Machine Bicep Curl': 'machine-bicep-curl',
  'Cable Curl': 'cable-curl',
  'Wrist Curl': 'wrist-curl',
  'Skull Crusher': 'skull-crusher',
  'Tricep Pushdown': 'tricep-pushdown',
  'Overhead Tricep Extension': 'overhead-tricep-extension',
  'Overhead Cable Extension': 'overhead-cable-extension',
  'Tricep Extension': 'tricep-extension',
  'Machine Tricep Extension': 'machine-tricep-extension',
  'Bench Dip': 'bench-dip',
  'Machine Dip': 'machine-dip',

  // ── Legs ────────────────────────────────────────────────────────────────
  'Sumo Deadlift': 'sumo-deadlift',
  'Trap Bar Deadlift': 'trap-bar-deadlift',
  'Back Squat': 'back-squat',
  'Front Squat': 'front-squat',
  'Zercher Squat': 'zercher-squat',
  'Smith Machine Squat': 'smith-machine-squat',
  'Goblet Squat': 'goblet-squat',
  'Pistol Squat': 'pistol-squat',
  'Hack Squat': 'hack-squat',
  'Leg Press': 'leg-press',
  'Romanian Deadlift': 'romanian-deadlift',
  'Dumbbell Romanian Deadlift': 'dumbbell-romanian-deadlift',
  'Stiff-Leg Deadlift': 'stiff-leg-deadlift',
  'Single-Leg Deadlift': 'single-leg-deadlift',
  'Glute Bridge': 'glute-bridge',
  'Cable Kickback': 'cable-kickback',
  'Bulgarian Split Squat': 'bulgarian-split-squat',
  'Walking Lunge': 'walking-lunge',
  'Reverse Lunge': 'reverse-lunge',
  'Barbell Lunge': 'barbell-lunge',
  'Static Lunge': 'static-lunge',
  'Step-Up': 'step-up',
  'Leg Extension': 'leg-extension',
  'Leg Curl': 'leg-curl',
  'Seated Leg Curl': 'seated-leg-curl',
  'Glute Ham Raise': 'glute-ham-raise',
  'Nordic Hamstring Curl': 'nordic-hamstring-curl',
  'Hip Abduction': 'hip-abduction',
  'Hip Adduction': 'hip-adduction',
  'Calf Raise': 'calf-raise',
  'Standing Calf Raise': 'standing-calf-raise',
  'Seated Calf Raise': 'seated-calf-raise',
  'Calf Press': 'calf-press',
  'Barbell Bulgarian Split Squat': 'barbell-bulgarian-split-squat',

  // ── Core ────────────────────────────────────────────────────────────────
  Plank: 'plank',
  'Side Plank': 'side-plank',
  'Hanging Leg Raise': 'hanging-leg-raise',
  'Cable Crunch': 'cable-crunch',
  'Machine Crunch': 'machine-crunch',
  'Cable Woodchop': 'cable-woodchop',
  'Russian Twist': 'russian-twist',
  'Ab Wheel Rollout': 'ab-wheel-rollout',
  'Weighted Sit-Up': 'weighted-sit-up',
  'Decline Sit-Up': 'decline-sit-up',
  'Dead Bug': 'dead-bug',

  // ── Full Body ───────────────────────────────────────────────────────────
  'Power Clean': 'power-clean',
  Thruster: 'thruster',
  'Kettlebell Swing': 'kettlebell-swing',
  'Farmer\'s Walk': 'farmers-walk',
}

export interface ExerciseDemo {
  /** Animated WebP of the movement, looping. */
  loop: string
  /** First frame of the loop, shown while paused. */
  still: string
}

/**
 * The demo for an exercise, or null when there isn't one.
 *
 * `variantOfName` lets a variant fall back to its family's demo — a wide-grip
 * bench press looks like a bench press — which is how this extends to most of
 * the catalog without hand-mapping every variant.
 */
export function demoFor(name: string, variantOfName?: string | null): ExerciseDemo | null {
  const slug = DEMOS[name] ?? (variantOfName ? DEMOS[variantOfName] : undefined)
  if (!slug) return null
  return {
    loop: `/exercise-demos/${slug}.webp`,
    still: `/exercise-demos/${slug}.still.webp`,
  }
}

export function hasDemo(name: string, variantOfName?: string | null): boolean {
  return demoFor(name, variantOfName) !== null
}
