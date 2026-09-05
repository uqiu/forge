// Every slug in exerciseDemos.ts must have its loop and still on disk, every
// mapped exercise name must exist in the seed catalog, and every vendored file
// must be reachable from the map. A wrong slug is silent at build time and
// shows up as an empty sheet.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = join(HERE, '../../backend/seed.py')
const MAP = join(HERE, '../src/lib/exerciseDemos.ts')
const ASSETS = join(HERE, '../public/exercise-demos')

const src = readFileSync(MAP, 'utf8')

// Entries look like:  'Goblet Squat': 'goblet-squat',  — a one-word name needs
// no quotes, so `Deadlift: 'deadlift',` is just as valid and must match too.
const pairs = [
  ...src.matchAll(/^ {2}(?:'((?:\\.|[^'\\])*)'|(\w+)):\s*'([a-z0-9-]+)',/gm),
].map((m) => [(m[1] ?? m[2]).replace(/\\(['\\])/g, '$1'), m[3]])

const GROUPS = 'Chest|Back|Shoulders|Arms|Legs|Core|Full Body'
const catalog = new Set(
  [
    ...readFileSync(SEED, 'utf8').matchAll(
      new RegExp(`\\(\\s*"([^"]+)",\\s*"(?:${GROUPS})"`, 'g'),
    ),
  ].map((m) => m[1]),
)

const problems = []
for (const [name, slug] of pairs) {
  if (!catalog.has(name)) problems.push(`"${name}" is not a seed exercise`)
  for (const file of [`${slug}.webp`, `${slug}.still.webp`]) {
    if (!existsSync(join(ASSETS, file))) problems.push(`"${name}" → ${file} missing`)
  }
}

const mapped = new Set(pairs.map(([, slug]) => slug))
// The import writes SOURCES.json alongside the artwork; it maps to nothing.
const onDisk = readdirSync(ASSETS)
  .filter((f) => f.endsWith('.webp') && !f.endsWith('.still.webp'))
  .map((f) => f.replace(/\.webp$/, ''))
for (const slug of onDisk) {
  if (!mapped.has(slug)) problems.push(`${slug}.webp is vendored but nothing maps to it`)
}

console.log(`mapped exercises: ${pairs.length}`)
console.log(`vendored demos: ${onDisk.length}`)

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('every mapping resolves to artwork on disk')
