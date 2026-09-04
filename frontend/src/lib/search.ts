// Exercise names carry punctuation nobody types: "Plate-Loaded",
// "Single-Arm", "(Volume)". A plain substring match makes the hyphen
// mandatory, so "plate loaded" finds nothing. Matching normalises both sides
// and requires every query word to appear somewhere in the name, in any
// order — "plate loaded", "plateloaded" and "plate chest" all find
// "Plate-Loaded Incline Chest Press".

// Chinese adds a second name per exercise and no word spacing: a query is
// matched against the English name *and* its translation, and CJK survives
// normalisation so "卧推" finds 卧推 while "bench" still finds Bench Press.

import { tc } from './i18n'

const COMBINING_MARKS = /[̀-ͯ]/g
const KEPT = /[^a-z0-9㐀-䶿一-鿿豈-﫿]+/g

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(KEPT, ' ')
    .trim()

/** Precompiles the query so a list filter normalises it once, not per row. */
export function makeMatcher(query: string): (name: string) => boolean {
  const tokens = normalize(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return () => true
  return (name) => {
    const translated = tc(name)
    const spaced = normalize(translated === name ? name : `${name} ${translated}`)
    // Squashed lets a token span a separator the user left out ("plateloaded")
    const squashed = spaced.replace(/ /g, '')
    return tokens.every((t) => spaced.includes(t) || squashed.includes(t))
  }
}

export const matchesSearch = (name: string, query: string) => makeMatcher(query)(name)
