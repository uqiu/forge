import { ChevronDown, Link2, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import EquipmentGlyph from './EquipmentGlyph'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { fetchExercises, getCachedExercises } from '../lib/exerciseCache'
import { getLocale, intlLocale, t, tc, tm } from '../lib/i18n'
import { makeMatcher } from '../lib/search'
import type { Exercise } from '../lib/types'
import { cn } from '../lib/utils'
import ExerciseForm, { MUSCLE_GROUPS, type ExerciseFields } from './ExerciseForm'
import Sheet from './Sheet'

interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  // Superset flow: the parent owns the state so a mid-flow dismissal simply
  // leaves the first pick as a normal, unlinked exercise
  supersetStage?: 'first' | 'second' | null
  onStartSuperset?: () => void
  onCancelSuperset?: () => void
}

interface Family {
  baseId: number
  base: Exercise | null
  members: Exercise[]
}

/** "Close-Grip Bench Press" under base "Bench Press" reads as "Close-Grip";
 *  "Lat Pulldown (Wide Grip)" reads as "Wide Grip". Falls back to the full
 *  name when stripping the base leaves nothing sensible.
 *
 *  Runs on the canonical English names — the modifier only survives being
 *  peeled off the base if both are the stored spelling. Translate the result,
 *  not the input. */
export function variantLabel(name: string, baseName: string): string {
  // "Base (Wide Grip)" -> "Wide Grip"
  if (name.startsWith(`${baseName} (`) && name.endsWith(')')) {
    return name.slice(baseName.length + 2, -1).trim() || name
  }
  // "Paused Base" -> "Paused" — only when the base is a clean word-boundary
  // suffix, so "Single-Leg Extension" under "Leg Extension" stays whole
  if (name.endsWith(` ${baseName}`)) {
    return name.slice(0, -(baseName.length + 1)).trim() || name
  }
  return name
}

/** The distinctions that matter at a glance: how the movement is loaded. */
function equipmentChip(e: Exercise, base: Exercise | null): string | null {
  if (!base || e.id === base.id) return null
  if (e.equipment !== base.equipment) return e.equipment
  return null
}

const GRIP_OPTIONS = ['Overhand', 'Underhand', 'Neutral'] as const
const WIDTH_OPTIONS = ['Close', 'Wide'] as const
const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Machine', 'Plate-Loaded', 'Smith Machine', 'Cable'] as const
const ATTACHMENT_OPTIONS = ['Rope', 'Straight Bar', 'EZ Bar', 'V-Bar', 'Single Handle', 'Neutral-Grip Bar', 'Ankle Strap'] as const

function ToggleChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T | null
  onChange: (v: T | null) => void
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? null : opt)}
            className={cn(
              'touch-feedback rounded-full border px-3 py-1.5 text-sm font-medium',
              value === opt
                ? 'border-transparent bg-accent-soft text-primary'
                : 'text-muted-foreground',
            )}
          >
            {tc(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function VariantSheet({
  base,
  onClose,
  onCreated,
}: {
  base: Exercise
  onClose: () => void
  onCreated: (exercise: Exercise) => void
}) {
  const [grip, setGrip] = useState<string | null>(null)
  const [width, setWidth] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cableContext = (equipment ?? base.equipment) === 'Cable'

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const created = await api<Exercise>(`/exercises/${base.id}/variant`, {
        method: 'POST',
        body: {
          grip,
          grip_width: width,
          equipment,
          attachment: cableContext ? attachment : null,
        },
      })
      onCreated(created)
    } catch (e) {
      setError(e instanceof Error ? tm(e.message) : t('Could not create the variant'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={t('Variant of {name}', { name: tc(base.name) })}>
      <div className="flex flex-col gap-4 pt-1 pb-2">
        <p className="text-sm text-muted-foreground">
          {t(
            "Pick what's different — the variant tracks its own weights, history and PRs, grouped under {name}.",
            { name: tc(base.name) },
          )}
        </p>
        <ToggleChips label={t('Grip')} options={GRIP_OPTIONS} value={grip as never} onChange={setGrip} />
        <ToggleChips label={t('Width')} options={WIDTH_OPTIONS} value={width as never} onChange={setWidth} />
        <ToggleChips
          label={t('Loaded by')}
          options={EQUIPMENT_OPTIONS}
          value={equipment as never}
          onChange={setEquipment}
        />
        {cableContext && (
          <ToggleChips
            label={t('Attachment')}
            options={ATTACHMENT_OPTIONS}
            value={attachment as never}
            onChange={setAttachment}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          onClick={create}
          disabled={busy || !(grip || width || equipment || attachment)}
          className="touch-feedback h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? t('Creating…') : t('Create variant')}
        </button>
      </div>
    </Sheet>
  )
}

export default function ExercisePicker({
  open,
  onClose,
  onPick,
  supersetStage,
  onStartSuperset,
  onCancelSuperset,
}: ExercisePickerProps) {
  const [exercises, setExercises] = useState<Exercise[]>(() => getCachedExercises() ?? [])
  const [query, setQuery] = useState('')
  const supersetBannerRef = useRef<HTMLDivElement>(null)

  // Fresh start for the second pick: old search results would hide the
  // stage change entirely
  useEffect(() => {
    if (supersetStage === 'second') {
      setQuery('')
      // After the cleared-query re-render, or the list height shift eats the scroll
      const id = setTimeout(
        () => supersetBannerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
        80,
      )
      return () => clearTimeout(id)
    }
  }, [supersetStage])
  const [group, setGroup] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [variantBase, setVariantBase] = useState<Exercise | null>(null)

  useEffect(() => {
    if (open) {
      // Instant from cache, then revalidate (last_used ordering shifts often)
      const cached = getCachedExercises()
      if (cached) setExercises(cached)
      fetchExercises().then(setExercises).catch(() => {})
      setQuery('')
      setGroup(null)
      setCreating(false)
      setError('')
      setExpanded(new Set())
      setVariantBase(null)
    }
  }, [open])

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const searching = query.trim().length > 0

  const families = useMemo(() => {
    const match = makeMatcher(query)
    const matches = (e: Exercise) => (!group || e.muscle_group === group) && match(e.name)
    const map = new Map<number, Exercise[]>()
    for (const e of exercises) {
      if (!matches(e)) continue
      const rootId = e.variant_of_id ?? e.id
      map.set(rootId, [...(map.get(rootId) ?? []), e])
    }
    const result: Family[] = [...map.entries()].map(([baseId, members]) => {
      const base = byId.get(baseId) ?? null
      members.sort((a, b) => {
        if (a.id === baseId) return -1
        if (b.id === baseId) return 1
        const baseEq = byId.get(baseId)?.equipment
        const ae = a.equipment !== baseEq ? a.equipment : ''
        const be = b.equipment !== baseEq ? b.equipment : ''
        return (
          tc(ae).localeCompare(tc(be), intlLocale()) ||
          tc(a.name).localeCompare(tc(b.name), intlLocale())
        )
      })
      return { baseId, base, members }
    })
    // Alphabetical by the name on screen — English order in a Chinese list
    // reads as no order at all.
    result.sort((a, b) =>
      tc(a.base?.name ?? a.members[0].name).localeCompare(
        tc(b.base?.name ?? b.members[0].name),
        intlLocale(),
      ),
    )
    return result
  }, [exercises, byId, query, group, getLocale()])

  // Most recently trained, shown only on the unfiltered view
  const recent = useMemo(
    () =>
      searching || group
        ? []
        : exercises
            .filter((e) => e.last_used != null)
            .sort((a, b) => (b.last_used! > a.last_used! ? 1 : -1))
            .slice(0, 5),
    [exercises, searching, group],
  )

  const createExercise = async (fields: ExerciseFields) => {
    setError('')
    try {
      const created = await api<Exercise>('/exercises', { method: 'POST', body: fields })
      onPick(created)
    } catch (e) {
      setError(e instanceof Error ? tm(e.message) : t('Failed to create exercise'))
    }
  }

  const toggleFamily = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderVariantRow = (e: Exercise, base: Exercise | null) => {
    const englishLabel = base ? variantLabel(e.name, base.name) : e.name
    const label = tc(englishLabel)
    // Redundancy is decided on the English label — that's where the modifier
    // words the chips would repeat actually live.
    const rawChip = equipmentChip(e, base)
    const chip =
      rawChip && !englishLabel.toLowerCase().includes(rawChip.toLowerCase()) ? rawChip : null
    const attachment =
      e.attachment && !englishLabel.toLowerCase().includes(e.attachment.toLowerCase())
        ? e.attachment
        : null
    return (
      <li key={e.id} className="cv-auto">
        <button
          onClick={() => onPick(e)}
          className="touch-feedback flex w-full items-center gap-2 py-2.5 pr-2 pl-7 text-left"
        >
          <span className="min-w-0 truncate font-medium">{label}</span>
          {chip && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {tc(chip)}
            </span>
          )}
          {attachment && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {tc(attachment)}
            </span>
          )}
          {e.is_custom && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
              {t('Custom')}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={creating ? t('New exercise') : t('Add exercise')} full>
      {creating ? (
        <ExerciseForm
          submitLabel={t('Create')}
          onSubmit={createExercise}
          error={error}
          secondaryAction={
            <button
              onClick={() => setCreating(false)}
              className="touch-feedback h-11 flex-1 rounded-lg bg-secondary font-semibold text-secondary-foreground"
            >
              {t('Back')}
            </button>
          }
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-5 bg-popover px-5 pt-1 pb-2">
            <div className="relative">
              <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search exercises')}
                enterKeyHint="search"
                className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-10 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {MUSCLE_GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(group === g ? null : g)}
                  className={cn(
                    'touch-feedback shrink-0 rounded-full px-3 py-1.5 text-sm font-medium',
                    group === g
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground',
                  )}
                >
                  {tc(g)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="touch-feedback mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left font-medium text-primary"
          >
            <Plus size={18} /> {t('Create custom exercise')}
          </button>
          {onStartSuperset && !supersetStage && (
            <button
              onClick={onStartSuperset}
              className="touch-feedback flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left font-medium text-primary"
            >
              <Link2 size={18} /> {t('Add superset')}
            </button>
          )}
          {supersetStage && (
            <div
              ref={supersetBannerRef}
              className="mt-1 mb-1 flex items-center gap-2.5 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-medium text-primary"
            >
              <Link2 size={16} className="shrink-0" />
              <span className="flex-1">
                {supersetStage === 'first'
                  ? t('Superset — pick the first exercise')
                  : t('Superset — pick the second exercise')}
              </span>
              <button
                onClick={onCancelSuperset}
                aria-label={t('Cancel superset')}
                className="touch-feedback -mr-1 rounded-full p-1"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {recent.length > 0 && (
            <>
              <h3 className="mt-1 mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('Recent')}
              </h3>
              <ul className="mb-2 divide-y divide-border/60">
                {recent.map((e) => (
                  <li key={`recent-${e.id}`}>
                    <button
                      onClick={() => onPick(e)}
                      className="touch-feedback flex w-full items-center gap-2.5 px-2 py-2.5 text-left"
                    >
                      <EquipmentGlyph equipment={e.equipment} size={16} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate font-medium">{tc(e.name)}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {tc(e.muscle_group)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <h3 className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('All exercises')}
              </h3>
            </>
          )}
          <ul className="divide-y divide-border">
            {families.map((family) => {
              const head = family.base ?? family.members[0]
              const variants = family.members.filter((m) => m.id !== head.id)
              const isOpen = searching || expanded.has(family.baseId)
              return (
                <li key={family.baseId} className="cv-auto">
                  <div className="flex items-center">
                    <button
                      onClick={() => onPick(head)}
                      className="touch-feedback flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-2 text-left"
                    >
                      <EquipmentGlyph
                        equipment={head.equipment}
                        size={18}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tc(head.name)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {tc(head.muscle_group)} · {tc(head.equipment)}
                          {head.attachment && ` · ${tc(head.attachment)}`}
                          {head.grip && ` · ${tc(head.grip)}`}
                          {head.is_custom && ` · ${t('Custom')}`}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => toggleFamily(family.baseId)}
                      className="touch-feedback flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground"
                      aria-label={t('Variants of {name}', { name: tc(head.name) })}
                    >
                      {variants.length > 0 && <span className="tnum">{variants.length}</span>}
                      <ChevronDown
                        size={16}
                        className={cn('transition-transform', isOpen && 'rotate-180')}
                      />
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="mb-1 divide-y divide-border/40 border-t border-border/40">
                      <li>
                        <button
                          onClick={() => onPick(head)}
                          className="touch-feedback flex w-full items-center gap-2 py-2.5 pr-2 pl-7 text-left"
                        >
                          <span className="min-w-0 truncate font-medium">{t('Standard')}</span>
                          {head.attachment && (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {tc(head.attachment)}
                            </span>
                          )}
                          {head.grip && (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {tc(head.grip)}
                            </span>
                          )}
                        </button>
                      </li>
                      {variants.map((v) => renderVariantRow(v, family.base))}
                      <li>
                        <button
                          onClick={() => setVariantBase(head)}
                          className="touch-feedback flex w-full items-center gap-1.5 py-2.5 pr-2 pl-7 text-left text-sm font-medium text-primary"
                        >
                          <SlidersHorizontal size={14} /> {t('New variant')}
                        </button>
                      </li>
                    </ul>
                  )}
                </li>
              )
            })}
            {families.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                {t('No exercises found')}
              </li>
            )}
          </ul>
          {variantBase && (
            <VariantSheet
              base={variantBase}
              onClose={() => setVariantBase(null)}
              onCreated={(created) => {
                setVariantBase(null)
                onPick(created)
              }}
            />
          )}
        </>
      )}
    </Sheet>
  )
}
