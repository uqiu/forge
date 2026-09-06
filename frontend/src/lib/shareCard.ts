/** Renders a finished workout as a shareable image and hands it to the
 *  system share sheet (Web Share API level 2). Falls back to a download
 *  where file-sharing isn't available. */
import { formatDuration, formatSetWeight, formatVolume } from './format'
import { intlLocale, t, tc } from './i18n'

export interface ShareCardSet {
  weight: number | null
  reps: number | null
  is_pr?: boolean
}

export interface ShareCardExercise {
  name: string
  sets: ShareCardSet[]
}

export interface ShareCardData {
  name: string
  duration_seconds: number
  total_volume: number
  total_sets: number
  prs: { exercise_name: string; kind: string; value: number; weight?: number; reps: number }[]
  comparison?: { prev_volume: number; prev_date: string } | null
  date?: Date
  music?: { songs: number; top_artist: string | null; pr_song: string | null }
  exercises?: ShareCardExercise[]
}

/** The working sets of a workout, in card shape. Warm-ups are left out so the
 *  listing agrees with the "Sets" tile, which counts working sets only. */
export function shareCardExercises(
  exercises: {
    name: string
    sets: {
      weight: number | null
      reps: number | null
      is_pr?: boolean
      is_warmup?: boolean
      is_completed?: boolean
    }[]
  }[],
): ShareCardExercise[] {
  return exercises
    .map((we) => ({
      name: we.name,
      sets: we.sets
        .filter((s) => s.is_completed !== false && !s.is_warmup && s.reps != null)
        .map((s) => ({ weight: s.weight, reps: s.reps, is_pr: s.is_pr })),
    }))
    .filter((we) => we.sets.length > 0)
}

// Tome/Forge dark tokens, hex-approximated for canvas
const BG = '#171412'
const CARD = '#211d1a'
const BORDER = '#37312c'
const INK = '#ece7e0'
const MUTED = '#a49c92'
const EMBER = '#de844f'
const RECORD = '#d4a843'

const W = 1080
const PAD = 88
// Stays well inside the ~16.7M-pixel canvas area iOS Safari allows
const MAX_H = 12000

/** A vertical slice of the card: it knows its own height *before* anything is
 *  painted, so the canvas can be sized to exactly what gets drawn. Every block
 *  measures with the same context it later paints with — the old version
 *  guessed heights from character counts, and anything the guess was short by
 *  fell off the bottom of the image. */
interface Block {
  h: number
  paint: (ctx: CanvasRenderingContext2D, top: number) => void
}

type Span = { text: string; color: string }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Greedy wrap that also breaks *inside* a run with no spaces in it — Chinese
 *  has no word boundaries, so space-splitting alone would never wrap. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  const flush = () => {
    if (line) lines.push(line)
    line = ''
  }
  for (const word of text.split(' ')) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width <= maxWidth) {
      line = probe
      continue
    }
    flush()
    if (ctx.measureText(word).width <= maxWidth) {
      line = word
      continue
    }
    // Single run wider than the card — break it character by character
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > maxWidth && line) flush()
      line += ch
    }
  }
  flush()
  return lines
}

/** Wrap coloured spans onto lines, breaking between spans and, if one span is
 *  itself too wide, inside it. Set lists come in as one span per set so a PR
 *  set can keep its own colour. */
function wrapSpans(ctx: CanvasRenderingContext2D, spans: Span[], maxWidth: number): Span[][] {
  const lines: Span[][] = []
  let line: Span[] = []
  let width = 0
  const flush = () => {
    if (line.length) lines.push(line)
    line = []
    width = 0
  }
  for (const span of spans) {
    const w = ctx.measureText(span.text).width
    if (width > 0 && width + w > maxWidth) flush()
    if (w <= maxWidth) {
      line.push(span)
      width += w
      continue
    }
    // One span wider than a full line — split it character by character
    let chunk = ''
    for (const ch of span.text) {
      const cw = ctx.measureText(chunk + ch).width
      if (width + cw > maxWidth && (chunk || width)) {
        if (chunk) line.push({ text: chunk, color: span.color })
        flush()
        chunk = ''
      }
      chunk += ch
    }
    if (chunk) {
      line.push({ text: chunk, color: span.color })
      width += ctx.measureText(chunk).width
    }
  }
  flush()
  return lines
}

function paintSpans(ctx: CanvasRenderingContext2D, spans: Span[], x: number, y: number) {
  let cursor = x
  for (const span of spans) {
    ctx.fillStyle = span.color
    ctx.fillText(span.text, cursor, y)
    cursor += ctx.measureText(span.text).width
  }
}

/** Trim to fit the space actually available, measured — not guessed from a
 *  character count, which overflowed for any name of mixed width. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = ''
  for (const ch of text) {
    if (ctx.measureText(`${out}${ch}…`).width > maxWidth) break
    out += ch
  }
  return `${out}…`
}

const TITLE_FONT = "700 92px 'Bricolage Grotesque', 'Onest', sans-serif"
const SECTION_FONT = "600 30px 'Onest', sans-serif"
const NAME_FONT = "600 36px 'Onest', sans-serif"
const BODY_FONT = "500 30px 'Onest', sans-serif"

function buildBlocks(ctx: CanvasRenderingContext2D, summary: ShareCardData, unit: string): Block[] {
  const blocks: Block[] = []
  const contentW = W - PAD * 2

  // Wordmark + date; its height is the gap the title has always started after
  blocks.push({
    h: 240,
    paint: (c, top) => {
      c.fillStyle = EMBER
      c.font = "700 44px 'Bricolage Grotesque', 'Onest', sans-serif"
      c.fillText('Forge', PAD, top + PAD)
      const date = (summary.date ?? new Date()).toLocaleDateString(intlLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      c.fillStyle = MUTED
      c.font = "500 34px 'Onest', sans-serif"
      c.textAlign = 'right'
      c.fillText(date, W - PAD, top + PAD + 8)
      c.textAlign = 'left'
    },
  })

  // Workout name — every line it needs, since the card grows to hold them
  ctx.font = TITLE_FONT
  const titleLines = wrapText(ctx, tc(summary.name), contentW)
  blocks.push({
    h: titleLines.length * 108 + 24,
    paint: (c, top) => {
      c.fillStyle = INK
      c.font = TITLE_FONT
      titleLines.forEach((line, i) => c.fillText(line, PAD, top + i * 108))
    },
  })

  // Stat tiles
  const stats: [string, string][] = [
    [formatDuration(summary.duration_seconds), t('Duration')],
    [formatVolume(summary.total_volume, unit), t('Volume')],
    [String(summary.total_sets), t('Sets')],
  ]
  const tileGap = 24
  const tileW = (contentW - tileGap * 2) / 3
  const tileH = 190
  blocks.push({
    h: tileH + 48,
    paint: (c, top) => {
      stats.forEach(([value, label], i) => {
        const x = PAD + i * (tileW + tileGap)
        c.fillStyle = CARD
        roundRect(c, x, top, tileW, tileH, 28)
        c.fill()
        c.strokeStyle = BORDER
        c.lineWidth = 2
        c.stroke()
        c.fillStyle = INK
        c.font = "700 56px 'Onest', sans-serif"
        c.fillText(value, x + 36, top + 44)
        c.fillStyle = MUTED
        c.font = BODY_FONT
        c.fillText(label, x + 36, top + 120)
      })
    },
  })

  // Volume delta vs last time
  if (summary.comparison && summary.comparison.prev_volume > 0) {
    const delta = Math.round(
      ((summary.total_volume - summary.comparison.prev_volume) / summary.comparison.prev_volume) *
        100,
    )
    if (delta !== 0) {
      blocks.push({
        h: 76,
        paint: (c, top) => {
          c.fillStyle = delta > 0 ? EMBER : MUTED
          c.font = "600 36px 'Onest', sans-serif"
          c.fillText(
            t('{delta}% volume vs last time', { delta: `${delta > 0 ? '+' : ''}${delta}` }),
            PAD,
            top,
          )
        },
      })
    }
  }

  // PRs — all of them; the card used to stop at five
  if (summary.prs.length > 0) {
    const rowH = 96
    const rows = summary.prs.map((pr) => {
      ctx.font = "500 34px 'Onest', sans-serif"
      const value =
        pr.kind === 'weight'
          ? `${pr.value} ${unit} × ${pr.reps}`
          : pr.kind === '1rm'
            ? `${t('est. 1RM')} ${pr.value} ${unit}${pr.weight ? ` (${pr.weight} × ${pr.reps})` : ''}`
            : t('{n} reps', { n: pr.value })
      const valueW = ctx.measureText(value).width
      ctx.font = NAME_FONT
      const nameW = W - PAD - 32 - valueW - 24 - (PAD + 148)
      return { name: ellipsize(ctx, tc(pr.exercise_name), Math.max(80, nameW)), value }
    })
    blocks.push({
      h: 56 + rows.length * (rowH + 16),
      paint: (c, top) => {
        c.fillStyle = MUTED
        c.font = SECTION_FONT
        c.fillText(t('card|PERSONAL RECORDS'), PAD, top)
        let y = top + 56
        for (const row of rows) {
          c.fillStyle = CARD
          roundRect(c, PAD, y, contentW, rowH, 24)
          c.fill()
          c.strokeStyle = BORDER
          c.lineWidth = 2
          c.stroke()
          c.fillStyle = 'rgba(212,168,67,0.16)'
          roundRect(c, PAD + 28, y + 26, 88, 44, 22)
          c.fill()
          c.fillStyle = RECORD
          c.font = "700 28px 'Onest', sans-serif"
          c.fillText(t('PR'), PAD + 54, y + 34)
          c.fillStyle = INK
          c.font = NAME_FONT
          c.fillText(row.name, PAD + 148, y + 30)
          c.fillStyle = MUTED
          c.textAlign = 'right'
          c.font = "500 34px 'Onest', sans-serif"
          c.fillText(row.value, W - PAD - 32, y + 32)
          c.textAlign = 'left'
          y += rowH + 16
        }
      },
    })
  }

  // Every exercise and the sets that went with it — the actual session
  const exercises = summary.exercises ?? []
  if (exercises.length > 0) {
    const inset = 32
    const textW = contentW - inset * 2
    const laidOut = exercises.map((we) => {
      ctx.font = NAME_FONT
      const count =
        we.sets.length === 1 ? t('{n} set', { n: 1 }) : t('{n} sets', { n: we.sets.length })
      const countW = ctx.measureText(count).width
      const name = ellipsize(ctx, tc(we.name), Math.max(120, textW - countW - 24))
      ctx.font = BODY_FONT
      // The separator rides along with the set before it, so a wrap never
      // leaves a dangling "·" at the start of a line
      const spans: Span[] = we.sets.map((s, i) => ({
        text: `${formatSetWeight(s.weight, unit)} × ${s.reps ?? 0}${i < we.sets.length - 1 ? ' · ' : ''}`,
        color: s.is_pr ? RECORD : MUTED,
      }))
      const lines = wrapSpans(ctx, spans, textW)
      return { name, count, lines, h: 28 + 44 + lines.length * 44 + 24 }
    })
    blocks.push({
      h: 56 + laidOut.reduce((sum, we) => sum + we.h + 16, 0),
      paint: (c, top) => {
        c.fillStyle = MUTED
        c.font = SECTION_FONT
        c.fillText(t('card|EXERCISES'), PAD, top)
        let y = top + 56
        for (const we of laidOut) {
          c.fillStyle = CARD
          roundRect(c, PAD, y, contentW, we.h, 24)
          c.fill()
          c.strokeStyle = BORDER
          c.lineWidth = 2
          c.stroke()
          c.fillStyle = INK
          c.font = NAME_FONT
          c.fillText(we.name, PAD + inset, y + 28)
          c.fillStyle = MUTED
          c.textAlign = 'right'
          c.fillText(we.count, W - PAD - inset, y + 30)
          c.textAlign = 'left'
          c.font = BODY_FONT
          we.lines.forEach((line, i) => paintSpans(c, line, PAD + inset, y + 72 + i * 44))
          y += we.h + 16
        }
      },
    })
  }

  // Soundtrack
  if (summary.music && summary.music.songs > 0) {
    const music = summary.music
    ctx.font = "500 34px 'Onest', sans-serif"
    const line =
      (music.songs === 1 ? t('{n} song', { n: music.songs }) : t('{n} songs', { n: music.songs })) +
      (music.top_artist ? ` · ${t('mostly {artist}', { artist: music.top_artist })}` : '')
    const lines = wrapText(ctx, line, contentW - 52)
    ctx.font = "600 32px 'Onest', sans-serif"
    const prSong = music.pr_song
      ? wrapText(ctx, t('PR song: {song}', { song: music.pr_song }), contentW - 52)
      : []
    blocks.push({
      h: 24 + (lines.length + prSong.length) * 54,
      paint: (c, top) => {
        c.fillStyle = EMBER
        c.font = "600 34px 'Onest', sans-serif"
        c.fillText('♪', PAD, top + 24)
        c.fillStyle = INK
        c.font = "500 34px 'Onest', sans-serif"
        let y = top + 24
        for (const l of lines) {
          c.fillText(l, PAD + 52, y)
          y += 54
        }
        c.fillStyle = RECORD
        c.font = "600 32px 'Onest', sans-serif"
        for (const l of prSong) {
          c.fillText(l, PAD + 52, y)
          y += 54
        }
      },
    })
  }

  // Footer
  blocks.push({
    h: 60 + 30 + PAD,
    paint: (c, top) => {
      c.fillStyle = MUTED
      c.font = BODY_FONT
      c.fillText(t('Tracked with Forge — self-hosted iron tracking'), PAD, top + 60)
    },
  })

  return blocks
}

function drawCard(summary: ShareCardData, unit: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'top'

  // Measure first, then size the canvas to the total — resizing a canvas
  // resets its context, so measuring has to happen before the real height.
  const blocks = buildBlocks(ctx, summary, unit)
  const H = Math.max(
    760,
    blocks.reduce((sum, b) => sum + b.h, 0),
  )

  // Browsers cap the pixel area of a canvas; a marathon session that would
  // exceed it is drawn smaller rather than coming back blank
  const scale = Math.min(1, MAX_H / H)
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  ctx.scale(scale, scale)
  ctx.textBaseline = 'top'

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // Ember glow up top so the card isn't a flat void
  const glow = ctx.createRadialGradient(W / 2, -200, 60, W / 2, -200, 900)
  glow.addColorStop(0, 'rgba(222,132,79,0.28)')
  glow.addColorStop(1, 'rgba(222,132,79,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, Math.min(700, H))

  let y = 0
  for (const block of blocks) {
    // The footer hangs off the bottom edge, not off the last block, so a short
    // card keeps its minimum height without a gap in the middle of the content
    if (block === blocks[blocks.length - 1]) y = H - block.h
    block.paint(ctx, y)
    y += block.h
  }

  return canvas
}

export async function shareWorkoutCard(summary: ShareCardData, unit: string): Promise<void> {
  // Make sure the display fonts are actually loaded before drawing — and
  // before measuring, since the layout is built from measured text
  try {
    await Promise.all([
      document.fonts.load("700 92px 'Bricolage Grotesque'"),
      document.fonts.load("600 36px 'Onest'"),
      document.fonts.load("500 30px 'Onest'"),
      document.fonts.load("500 34px 'Onest'"),
    ])
  } catch {
    // system fallback fonts still render fine
  }
  const canvas = drawCard(summary, unit)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render the card')
  const file = new File([blob], 'workout.png', { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      // user cancelled the sheet — not an error
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'workout.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
