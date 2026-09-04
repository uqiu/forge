import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { demoFor } from '../lib/exerciseDemos'
import { t, tc } from '../lib/i18n'

const FRAME_MS = 700

/** How the movement looks: the vendored frames played as a loop.
 *
 *  All frames are rendered at once and revealed by opacity rather than swapped
 *  by src — swapping would flash white on the first pass through, before the
 *  next file is in the browser cache. Autoplay yields to
 *  prefers-reduced-motion, which leaves a still first frame and the play
 *  button.
 *
 *  The attribution line is not decoration: the artwork is CC BY-SA 4.0, which
 *  requires crediting the author and naming the licence wherever it's shown. */
export default function ExerciseDemoSheet({
  name,
  variantOfName,
  open,
  onClose,
}: {
  name: string
  variantOfName?: string | null
  open: boolean
  onClose: () => void
}) {
  const demo = demoFor(name, variantOfName)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!open) return
    setFrame(0)
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [open])

  useEffect(() => {
    if (!open || !playing || !demo) return
    const id = setInterval(() => setFrame((f) => (f + 1) % demo.frames.length), FRAME_MS)
    return () => clearInterval(id)
  }, [open, playing, demo])

  if (!demo) return null

  return (
    <Sheet open={open} onClose={onClose} title={tc(name)}>
      <div className="flex flex-col gap-3 pt-1 pb-2">
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-white">
          {demo.frames.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={
                i === 0
                  ? t('{name} — movement demonstration', { name: tc(name) })
                  : ''
              }
              aria-hidden={i !== 0}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain transition-opacity duration-150"
              style={{ opacity: i === frame ? 1 : 0 }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="touch-feedback flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground"
          >
            {playing ? <Pause size={15} /> : <Play size={15} className="fill-current" />}
            {playing ? t('Pause') : t('Play')}
          </button>
          <div className="flex gap-1.5">
            {demo.frames.map((src, i) => (
              <button
                key={src}
                onClick={() => {
                  setPlaying(false)
                  setFrame(i)
                }}
                aria-label={t('Frame {n}', { n: i + 1 })}
                className={
                  i === frame
                    ? 'h-2 w-6 rounded-full bg-primary'
                    : 'h-2 w-2 rounded-full bg-muted-foreground/30'
                }
              />
            ))}
          </div>
        </div>

        {variantOfName && (
          <p className="text-xs text-muted-foreground">
            {t('Showing {name} — the movement this variant is based on', {
              name: tc(variantOfName),
            })}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          {t('Artwork by')}{' '}
          <a
            href="https://github.com/everkinetic/data"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Everkinetic
          </a>{' '}
          {t('and')}{' '}
          <a href="https://bryllim.com" target="_blank" rel="noreferrer" className="underline">
            Bryl Lim
          </a>
          {' · '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            CC BY-SA 4.0
          </a>
        </p>
      </div>
    </Sheet>
  )
}
