import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { demoFor } from '../lib/exerciseDemos'
import { t, tc } from '../lib/i18n'

/** An animated WebP of the movement, vendored per `lib/exerciseDemos`.
 *
 *  An animated image can't be paused through the DOM, so pausing unmounts the
 *  loop and reveals the still frame layered underneath it — which also stops
 *  the decoding, and keeps the sheet from flashing empty on the swap. Playing
 *  again remounts the loop under a fresh key so it restarts from the top. */
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
  const [playing, setPlaying] = useState(true)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!open) return
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setRun((r) => r + 1)
  }, [open])

  if (!demo) return null

  return (
    <Sheet open={open} onClose={onClose} title={tc(name)}>
      <div className="flex flex-col gap-3 pt-1 pb-2">
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-white">
          <img
            src={demo.still}
            alt={t('{name} — movement demonstration', { name: tc(name) })}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
          {playing && (
            <img
              key={run}
              src={demo.loop}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
        </div>

        <div className="flex">
          <button
            onClick={() => {
              setPlaying((p) => !p)
              setRun((r) => r + 1)
            }}
            className="touch-feedback flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground"
          >
            {playing ? <Pause size={15} /> : <Play size={15} className="fill-current" />}
            {playing ? t('Pause') : t('Play')}
          </button>
        </div>

        {variantOfName && (
          <p className="text-xs text-muted-foreground">
            {t('Showing {name} — the movement this variant is based on', {
              name: tc(variantOfName),
            })}
          </p>
        )}
      </div>
    </Sheet>
  )
}
