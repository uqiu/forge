/** Translation singleton — gettext-style: the English copy *is* the key, so
 *  an untranslated string falls back to readable English instead of a token.
 *  Mirrors the theme/timer pattern: module state + listeners + a hook. */
import { useEffect, useState } from 'react'
import { ZH } from './zh'
import { ZH_ALIASES } from './zhAliases'
import { ZH_CATALOG } from './zhCatalog'
import { ZH_ERROR_PATTERNS, ZH_ERRORS } from './zhErrors'

export type Locale = 'zh' | 'en'

const LOCALE_KEY = 'forge_locale'

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
]

function detect(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored === 'zh' || stored === 'en') return stored
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

let locale: Locale = detect()
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return locale
}

/** BCP 47 tag for Intl — dates, numbers, weekday names. */
export function intlLocale(): string {
  return locale === 'zh' ? 'zh-CN' : 'en'
}

export function setLocale(next: Locale) {
  if (next === locale) return
  locale = next
  localStorage.setItem(LOCALE_KEY, next)
  document.documentElement.lang = intlLocale()
  listeners.forEach((l) => l())
}

/** Re-renders on locale change. Called in App() so the whole tree follows. */
export function useLocale(): Locale {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const l = () => setVersion((v) => v + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return locale
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  )
}

// A `context|` prefix on a key. Digits are allowed after the first letter
// ("weekday3|Mon"), which is why this isn't just [a-z]+.
const CONTEXT_PREFIX = /^[a-z][a-z0-9]*\|/

/**
 * Translate UI copy. `key` is the English source string; pass `vars` for
 * `{placeholder}` slots. Same-English-different-context strings disambiguate
 * with a `context|English` key — the context is stripped from the fallback.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  if (locale === 'en') return interpolate(key.replace(CONTEXT_PREFIX, ''), vars)
  const hit = ZH[key]
  return interpolate(hit ?? key.replace(CONTEXT_PREFIX, ''), vars)
}

/**
 * Translate catalog data the backend owns — exercise names, muscle groups,
 * equipment, grips, attachments, plan and scheme names. The English name stays
 * the canonical key everywhere (search families, PR history, the DB), so this
 * is display-only: anything the user created themselves passes through.
 */
export function tc(name: string | null | undefined): string {
  if (name == null) return ''
  if (locale === 'en') return name
  return ZH_CATALOG[name] ?? name
}

/**
 * Every string a search should match for a catalog name: the canonical
 * English, its Chinese display name, and the aliases people type instead.
 *
 * Deliberately independent of the current language — someone reading the app
 * in English still types 卧推, and someone reading it in Chinese still types
 * "bench" — and search-only, so none of it ever reaches the screen. Chinese
 * aliases can't produce false positives for an English query, or the reverse,
 * because the two alphabets don't overlap.
 */
export function searchTerms(name: string): string {
  const zh = ZH_CATALOG[name]
  const aliases = ZH_ALIASES[name]
  if (!zh && !aliases) return name
  return [name, zh, ...(aliases ?? [])].filter(Boolean).join(' ')
}

/** Translate a backend error `detail`, falling back to the server's wording. */
export function te(detail: string): string {
  if (locale === 'en') return detail
  const exact = ZH_ERRORS[detail]
  if (exact) return exact
  for (const [pattern, render] of ZH_ERROR_PATTERNS) {
    const match = detail.match(pattern)
    if (match) return render(match)
  }
  return detail
}

/**
 * Translate a message that could have come from either side of the wire — a
 * caught `Error.message` is a backend `detail` when the request reached the
 * server and one of our own strings when it didn't. The two dictionaries don't
 * overlap, so trying both is unambiguous, and an unknown message passes through.
 */
export function tm(message: string): string {
  return te(t(message))
}

document.documentElement.lang = intlLocale()
