/**
 * Vendors the movement demos from ExerciseGymGifsDB into public/exercise-demos.
 *
 *   git clone --depth 1 https://github.com/JahelCuadrado/ExerciseGymGifsDB.git
 *   node scripts/import-exercise-gifs.mjs /path/to/ExerciseGymGifsDB
 *
 * Each source GIF becomes two files: an animated WebP for the loop, and a
 * still WebP of its first frame for the paused state. The originals are
 * 200-400 KB apiece, which is a lot to ship thirteen times over for artwork
 * that plays in a sheet; the animated WebP is a quarter of that at a quality
 * where the line art is indistinguishable.
 *
 * Requires ImageMagick (`brew install imagemagick`).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) throw new Error('Pass the path to a checkout of ExerciseGymGifsDB')

const OUTPUT = new URL('../public/exercise-demos/', import.meta.url)

/** Local slug → the exercise's id in the source database.
 *
 *  Every pairing was checked by eye against the source GIF, not just its name:
 *  the database has a dozen near-namesakes per movement, and a plausible-looking
 *  wrong demo teaches the wrong lift. Notable calls:
 *    - the source has no "bulgarian split squat"; its single-leg split squat is
 *      the same movement, rear foot on the bench
 *    - "hanging leg raise" there is the bent-knee raise to parallel, which is
 *      our hanging knee raise ("hanging leg hip raise" adds a pelvic curl) */
const FIGURES = {
  'goblet-squat': 'quads/dumbbell-goblet-squat',
  'dumbbell-bench-press': 'pectorals/dumbbell-bench-press',
  'pull-up': 'lats/pull-up',
  'dumbbell-romanian-deadlift': 'glutes/dumbbell-romanian-deadlift',
  'incline-dumbbell-press': 'pectorals/dumbbell-incline-bench-press',
  'bicep-curl': 'biceps/dumbbell-biceps-curl',
  'seated-dumbbell-press': 'delts/dumbbell-seated-shoulder-press',
  'one-arm-dumbbell-row': 'upper-back/dumbbell-one-arm-bent-over-row',
  'bulgarian-split-squat': 'quads/dumbbell-single-leg-split-squat',
  'rear-delt-fly': 'delts/dumbbell-reverse-fly',
  'lateral-raise': 'delts/dumbbell-lateral-raise',
  'dumbbell-skull-crusher': 'triceps/dumbbell-lying-triceps-extension',
  'hanging-knee-raise': 'abs/hanging-leg-raise',
}

const magick = (...args) => execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'inherit'] })

let revision = 'unknown'
try {
  revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  console.warn('Could not read the source revision; recording it as unknown.')
}

rmSync(OUTPUT, { recursive: true, force: true })
mkdirSync(OUTPUT, { recursive: true })

const manifest = {}
for (const [slug, id] of Object.entries(FIGURES)) {
  const gif = fileURLToPath(new URL(`${id}.gif`, `file://${source.replace(/\/?$/, '/')}`))
  readFileSync(gif) // fail loudly here rather than inside ImageMagick
  const loop = fileURLToPath(new URL(`${slug}.webp`, OUTPUT))
  const still = fileURLToPath(new URL(`${slug}.still.webp`, OUTPUT))
  magick(gif, '-coalesce', '-quality', '80', '-define', 'webp:method=6', loop)
  // -delete 1--1 keeps only the first frame, after coalescing it into a full image
  magick(gif, '-coalesce', '-delete', '1--1', '-quality', '86', still)
  manifest[slug] = id
}

writeFileSync(
  fileURLToPath(new URL('SOURCES.json', OUTPUT)),
  `${JSON.stringify(
    {
      source: 'https://github.com/JahelCuadrado/ExerciseGymGifsDB',
      revision,
      note: 'GIFs belong to their original authors; the source repository only organizes them.',
      figures: manifest,
    },
    null,
    2,
  )}\n`,
)

console.log(`Imported ${Object.keys(FIGURES).length} demos from ${revision.slice(0, 12)}.`)
