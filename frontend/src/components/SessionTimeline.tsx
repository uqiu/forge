import { useMemo, useState } from 'react'
import { formatClock, formatSetWeight, formatTime, parseUTC } from '../lib/format'
import { getLocale, t, tc } from '../lib/i18n'
import type { Workout } from '../lib/types'

// Gaps outside this band are exercise changes / interruptions, not rest —
// same bounds the backend's pacing stats use.
const REST_MIN_MS = 15_000
const REST_MAX_MS = 600_000

interface Dot {
  x: number
  line1: string
  line2: string
  warmup: boolean
  pr: boolean
}

interface Lane {
  name: string
  dots: Dot[]
  medianGap: number | null // seconds between consecutive set completions
}

interface SongBlock {
  x: number
  w: number
  line1: string
  line2: string
  inferred: boolean
}

/** Recharts-style hover card, clamped so it never leaves the strip. */
function Tip({ x, line1, line2 }: { x: number; line1: string; line2: string }) {
  const align = x < 14 ? 'translate-x-0' : x > 86 ? '-translate-x-full' : '-translate-x-1/2'
  return (
    <div
      className={`pointer-events-none absolute bottom-full z-10 mb-1.5 ${align} rounded-[10px] border bg-popover px-2.5 py-1.5 text-[13px] whitespace-nowrap text-popover-foreground shadow-md`}
      style={{ left: `${x}%` }}
    >
      <div className="font-medium">{line1}</div>
      <div className="text-xs text-muted-foreground">{line2}</div>
    </div>
  )
}

/** Where the session's minutes went: one lane per exercise, a dot per set
 *  completion, the soundtrack running underneath on the same clock. Rendered
 *  only when the sets carry completion stamps (the iOS companion writes
 *  them; older PWA-only workouts fall back to nothing). */
export default function SessionTimeline({ workout, unit }: { workout: Workout; unit: string }) {
  const [hover, setHover] = useState<{ lane: number; i: number } | null>(null)

  const model = useMemo(() => {
    const t0 = parseUTC(workout.started_at).getTime()
    const tEnd = workout.finished_at ? parseUTC(workout.finished_at).getTime() : null
    if (!tEnd || tEnd <= t0) return null
    const span = tEnd - t0
    const x = (t: number) => Math.min(100, Math.max(0, ((t - t0) / span) * 100))

    let stamped = 0
    const lanes: Lane[] = []
    for (const we of workout.exercises) {
      const dots: Dot[] = []
      const times: number[] = []
      for (const s of we.sets) {
        if (!s.completed_at || s.reps == null) continue
        const at = parseUTC(s.completed_at).getTime()
        times.push(at)
        dots.push({
          x: x(at),
          line1: `${formatSetWeight(s.weight, unit)} × ${s.reps}${s.rpe != null ? ` @${s.rpe}` : ''}${s.is_pr ? ` · ${t('PR')}` : ''}${s.is_warmup ? ` · ${t('warm-up')}` : ''}`,
          line2: formatTime(s.completed_at),
          warmup: !!s.is_warmup,
          pr: !!s.is_pr,
        })
      }
      stamped += dots.length
      if (dots.length === 0) continue
      const gaps = times
        .slice(1)
        .map((t, i) => t - times[i])
        .filter((g) => g >= REST_MIN_MS && g <= REST_MAX_MS)
        .sort((a, b) => a - b)
      const medianGap = gaps.length > 0 ? Math.round(gaps[(gaps.length - 1) >> 1] / 1000) : null
      lanes.push({ name: we.name, dots, medianGap })
    }
    // A timeline of one or two stamps is noise, not insight
    if (stamped < 4 || lanes.length === 0) return null

    const songs: SongBlock[] = (workout.music ?? []).flatMap((song) => {
      const s = parseUTC(song.started_at).getTime()
      const e = song.ended_at ? parseUTC(song.ended_at).getTime() : s
      if (e < t0 || s > tEnd) return []
      const from = Math.max(s, t0)
      const to = Math.min(Math.max(e, s), tEnd)
      return [
        {
          x: x(from),
          w: Math.max(x(to) - x(from), 0.6),
          line1: song.title,
          line2: `${song.artist ? `${song.artist} · ` : ''}${formatTime(song.started_at)}${song.ended_at ? `–${formatTime(song.ended_at)}` : ''}${song.source === 'inferred' ? ' · ≈' : ''}`,
          inferred: song.source === 'inferred',
        },
      ]
    })

    const stepMin = span > 45 * 60_000 ? 10 : 5
    const ticks: { x: number; label: string }[] = []
    for (let m = 0; m * 60_000 <= span; m += stepMin) {
      ticks.push({ x: (m * 60_000 * 100) / span, label: `${m}` })
    }
    return { lanes, songs, ticks }
    // getLocale(): the dot tooltips bake in translated copy, so a language
    // switch has to rebuild the model, not just repaint around it.
  }, [workout, unit, getLocale()])

  if (!model) return null

  return (
    <section className="animate-card-appear mt-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('Timeline')}
        </span>
        <span className="text-[11px] text-muted-foreground">{t('minutes into the session')}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {model.lanes.map((lane, li) => (
          <div key={lane.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium">{tc(lane.name)}</span>
              {lane.medianGap != null && (
                <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                  {t('~{clock} between sets', { clock: formatClock(lane.medianGap) })}
                </span>
              )}
            </div>
            <div className="relative mt-0.5 mb-1.5 h-5">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {lane.dots.map((d, i) => (
                <span
                  key={i}
                  onMouseEnter={() => setHover({ lane: li, i })}
                  onMouseLeave={() => setHover(null)}
                  className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ left: `${d.x}%` }}
                >
                  <span
                    className={
                      d.pr
                        ? 'h-3 w-3 rotate-45 rounded-[3px] bg-record'
                        : d.warmup
                          ? 'h-2.5 w-2.5 rounded-full border-2 border-[var(--chart-accent)] bg-card'
                          : 'h-2.5 w-2.5 rounded-full bg-[var(--chart-accent)]'
                    }
                  />
                </span>
              ))}
              {hover?.lane === li && lane.dots[hover.i] && (
                <Tip
                  x={lane.dots[hover.i].x}
                  line1={lane.dots[hover.i].line1}
                  line2={lane.dots[hover.i].line2}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {model.songs.length > 0 && (
        <div className="relative mt-1 h-3">
          {model.songs.map((s, i) => (
            <span
              key={i}
              onMouseEnter={() => setHover({ lane: -1, i })}
              onMouseLeave={() => setHover(null)}
              className={
                s.inferred
                  ? 'absolute top-0 h-full rounded-sm bg-primary/25'
                  : i % 2 === 0
                    ? 'absolute top-0 h-full rounded-sm bg-primary/60'
                    : 'absolute top-0 h-full rounded-sm bg-primary/40'
              }
              style={{ left: `${s.x}%`, width: `${s.w}%` }}
            />
          ))}
          {hover?.lane === -1 && model.songs[hover.i] && (
            <Tip
              x={model.songs[hover.i].x + model.songs[hover.i].w / 2}
              line1={model.songs[hover.i].line1}
              line2={model.songs[hover.i].line2}
            />
          )}
        </div>
      )}

      <div className="relative mt-1 h-4 border-t border-border">
        {model.ticks.map((tick) => (
          <span
            key={tick.label}
            className="tnum absolute top-0.5 -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${tick.x}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t('● set · ○ warm-up ·')} <span className="text-record">◆</span> {t('PR')}
        {model.songs.length > 0 && ` · ${t('bottom strip: what was playing')}`}
      </p>
    </section>
  )
}
