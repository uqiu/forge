// Exercise names carry punctuation nobody types: "Plate-Loaded",
// "Single-Arm", "(Volume)". A plain substring match makes the hyphen
// mandatory, so "plate loaded" finds nothing. Matching normalises both sides
// and requires every query word to appear somewhere in the name, in any
// order — "plate loaded", "plateloaded" and "plate chest" all find
// "Plate-Loaded Incline Chest Press".

// Chinese adds more names per exercise and no word spacing. A query is matched
// against everything an exercise can be called — English, the Chinese display
// name, and the aliases people type instead (Chinese lifting vocabulary isn't
// standardised) — with CJK surviving normalisation, so "卧推", "平板卧推" and
// "bench" all find Bench Press whichever language the app is in.

import { searchTerms } from './i18n'

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
    const spaced = normalize(searchTerms(name))
    // Squashed lets a token span a separator the user left out ("plateloaded")
    const squashed = spaced.replace(/ /g, '')
    return tokens.every((t) => spaced.includes(t) || squashed.includes(t))
  }
}

export const matchesSearch = (name: string, query: string) => makeMatcher(query)(name)
