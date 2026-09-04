// Every key in zhAliases.ts / zhCatalog.ts must name a real seed exercise.
// A typo'd key is invisible at runtime — the alias simply never matches — so
// it gets caught here instead.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = join(HERE, '../../backend/seed.py')
const I18N = join(HERE, '../src/lib/i18n')

const GROUPS = 'Chest|Back|Shoulders|Arms|Legs|Core|Full Body'
const seed = readFileSync(SEED, 'utf8')
const catalog = new Set(
  [...seed.matchAll(new RegExp(`\\(\\s*"([^"]+)",\\s*"(?:${GROUPS})"`, 'g'))].map((m) => m[1]),
)

if (catalog.size < 200) {
  console.error(`Parsed only ${catalog.size} exercises from seed.py — the parser is stale.`)
  process.exit(1)
}

/** Top-level keys of an exported Record literal. */
function keysOf(file) {
  const src = readFileSync(join(I18N, file), 'utf8')
  return [...src.matchAll(/^ {2}(?:'((?:\\.|[^'\\])*)'|([A-Za-z_$][\w$]*)):/gm)].map((m) =>
    (m[1] ?? m[2]).replace(/\\(['\\])/g, '$1'),
  )
}

// zhCatalog also legitimately holds groups, equipment, modifiers, plan names
// and genres, so only its alias-shaped siblings are checked strictly.
const aliasKeys = keysOf('zhAliases.ts')
const unknown = aliasKeys.filter((k) => !catalog.has(k))

console.log(`seed exercises: ${catalog.size}`)
console.log(`alias keys:     ${aliasKeys.length}`)

if (unknown.length) {
  console.error(`\n${unknown.length} alias key(s) name no seed exercise:`)
  for (const k of unknown) console.error(`  ${JSON.stringify(k)}`)
  process.exit(1)
}
console.log('all alias keys resolve to a seed exercise')
