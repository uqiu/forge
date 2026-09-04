import { intlLocale, t } from './i18n'

/** Backend stores naive UTC datetimes — parse them as UTC. */
export function parseUTC(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}${t('unit|h')} ${m}${t('unit|m')}`
  if (m > 0) return sec > 0 ? `${m}${t('unit|m')} ${sec}${t('unit|s')}` : `${m}${t('unit|m')}`
  return `${sec}${t('unit|s')}`
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}

export function formatWeight(weight: number | null | undefined, unit: string): string {
  if (weight == null) return '—'
  const rounded = Math.round(weight * 100) / 100
  return `${rounded} ${unit}`
}

/** Set-line weight — 0 means an unloaded bodyweight set. */
export function formatSetWeight(weight: number | null | undefined, unit: string): string {
  if (weight == null || weight === 0) return t('BW')
  return formatWeight(weight, unit)
}

export function formatVolume(volume: number, unit: string): string {
  if (volume >= 10000) return `${Math.round(volume / 100) / 10}k ${unit}`
  return `${Math.round(volume)} ${unit}`
}

export function formatRelativeDate(value: string): string {
  const date = parseUTC(value)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (days === 0) return t('Today')
  if (days === 1) return t('Yesterday')
  if (days < 7) return date.toLocaleDateString(intlLocale(), { weekday: 'long' })
  return date.toLocaleDateString(intlLocale(), {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export function formatTime(value: string): string {
  return parseUTC(value).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })
}

export function formatShortDate(value: string): string {
  return parseUTC(value).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })
}

/** Value for <input type="datetime-local"> — local time, minute precision. */
export function toDatetimeLocal(value: string): string {
  const d = parseUTC(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function restLabel(seconds: number): string {
  if (seconds === 0) return t('rest|Off')
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
