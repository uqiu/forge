/** Which exercises have a demonstration to show, and where its frames live.
 *
 *  Keyed by the canonical English exercise name, like the display and alias
 *  dictionaries — the name in the database is the stable identity, and the
 *  demo is display-only.
 *
 *  Every pairing here was checked by hand against the source manifest's own
 *  name and equipment. Matching these by string similarity would be a bad
 *  trade: a plausible-looking wrong demo teaches the wrong movement, which is
 *  worse than no demo at all. That is also why coverage is deliberately
 *  partial — the button simply doesn't appear for an exercise that isn't here.
 *
 *  Artwork is derived from the user's training-figures-a3.html reference.
 *  The source SVGs preserve the start/end-position detail from that figure. */

/** Slug of the imported training figure, per canonical exercise name. */
const DEMOS: Record<string, string> = {
  // ── w-a计划 ──────────────────────────────────────────────────────────────
  'Goblet Squat': 'goblet-squat',
  'Dumbbell Bench Press': 'dumbbell-bench-press',
  'Pull-Up': 'pull-up',
  'Dumbbell Romanian Deadlift': 'dumbbell-romanian-deadlift',
  'Incline Dumbbell Press': 'incline-dumbbell-press',
  'Bicep Curl': 'bicep-curl',

  // ── w-b计划 ──────────────────────────────────────────────────────────────
  'Seated Dumbbell Press': 'seated-dumbbell-press',
  // The catalog's plain "Dumbbell Row" is the one-arm braced row
  'Dumbbell Row': 'one-arm-dumbbell-row',
  'Bulgarian Split Squat': 'bulgarian-split-squat',
  'Rear Delt Fly': 'rear-delt-fly',
  'Lateral Raise': 'lateral-raise',
  // Ours is the lying dumbbell extension, i.e. a two-dumbbell skullcrusher
  'Tricep Extension': 'dumbbell-skull-crusher',
  'Hanging Knee Raise': 'hanging-knee-raise',
}

export interface ExerciseDemo {
  /** Frame image URLs, in playback order. */
  frames: string[]
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
    frames: [`/exercise-demos/${slug}/frame-1.svg`, `/exercise-demos/${slug}/frame-2.svg`],
  }
}

export function hasDemo(name: string, variantOfName?: string | null): boolean {
  return demoFor(name, variantOfName) !== null
}
