// Every slug in exerciseDemos.ts must have its frames on disk, every mapped
// exercise name must exist in the seed catalog, and every vendored directory
// must be reachable from the map. A wrong slug is silent at build time and
// shows up as an empty sheet.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = join(HERE, '../../backend/seed.py')
const MAP = join(HERE, '../src/lib/exerciseDemos.ts')
const ASSETS = join(HERE, '../public/exercise-demos')

const FRAMES = 3
const src = readFileSync(MAP, 'utf8')

// Entries look like:  'Goblet Squat': 'goblet-squat',
const pairs = [...src.matchAll(/^ {2}'((?:\\.|[^'\\])*)':\s*'([a-z0-9-]+)',/gm)].map((m) => [
  m[1].replace(/\\(['\\])/g, '$1'),
  m[2],
])

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
  for (let i = 1; i <= FRAMES; i++) {
    const f = join(ASSETS, slug, `frame-${i}.svg`)
    if (!existsSync(f)) problems.push(`"${name}" → ${slug}/frame-${i}.svg missing`)
  }
}

const mapped = new Set(pairs.map(([, slug]) => slug))
const onDisk = readdirSync(ASSETS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
for (const slug of onDisk) {
  if (!mapped.has(slug)) problems.push(`${slug}/ is vendored but nothing maps to it`)
}

if (!existsSync(join(ASSETS, 'ATTRIBUTION.json'))) {
  problems.push('ATTRIBUTION.json is missing — the art is CC BY-SA, credit ships with it')
}

console.log(`mapped exercises: ${pairs.length}`)
console.log(`vendored slugs:   ${onDisk.length}`)
console.log(`frames:           ${onDisk.length * FRAMES}`)

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('every mapping resolves to frames on disk')
