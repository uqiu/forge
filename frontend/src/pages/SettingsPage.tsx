import { BookOpen, Copy, DatabaseBackup, Download, KeyRound, LogOut, Minus, Plus, Shield, Tags, Trash2, Upload, UserPlus, Webhook } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, getToken } from '../lib/api'
import { MUSCLE_GROUPS } from '../components/ExerciseForm'
import type { Exercise } from '../lib/types'
import ConfirmSheet from '../components/ConfirmSheet'
import Segmented from '../components/Segmented'
import Sheet from '../components/Sheet'
import { useAuth } from '../contexts/AuthContext'
import { formatRelativeDate, restLabel } from '../lib/format'
import { getLocale, intlLocale, LOCALES, setLocale, t, tc, tm, type Locale } from '../lib/i18n'
import { disableRestPush, enableRestPush, pushEnabled, pushSupported } from '../lib/push'
import { isRpeEnabled, setRpeEnabled } from '../lib/prefs'
import { toast } from '../lib/toast'
import { isTimerSoundEnabled, setTimerSoundEnabled } from '../lib/timer'
import { applyTheme, getStoredTheme, THEMES, type ThemeId } from '../lib/theme'
import type { User } from '../lib/types'

/** Bulk muscle-group fixer — imported exercises mostly land in 'Other'. */
function RecategorizeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [changes, setChanges] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setChanges({})
      api<Exercise[]>('/exercises')
        .then((all) =>
          setExercises(
            all
              .filter((e) => e.is_custom)
              .sort((a, b) =>
                a.muscle_group === b.muscle_group
                  ? tc(a.name).localeCompare(tc(b.name), intlLocale())
                  : a.muscle_group === 'Other'
                    ? -1
                    : b.muscle_group === 'Other'
                      ? 1
                      : tc(a.muscle_group).localeCompare(tc(b.muscle_group), intlLocale()),
              ),
          ),
        )
        .catch(() => {})
    }
  }, [open])

  const changed = Object.keys(changes).length

  const save = async () => {
    setSaving(true)
    try {
      await api('/exercises/recategorize', {
        method: 'POST',
        body: { items: Object.entries(changes).map(([id, muscle_group]) => ({ id: Number(id), muscle_group })) },
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('Re-categorize exercises')} full>
      {exercises.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('No custom exercises yet — imported and self-created exercises show up here.')}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {t('Fix muscle groups in one pass — imports land in “Other”.')}
          </p>
          <div className="divide-y divide-border">
            {exercises.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate font-medium">{tc(e.name)}</span>
                <select
                  value={changes[e.id] ?? e.muscle_group}
                  onChange={(ev) => setChanges((c) => ({ ...c, [e.id]: ev.target.value }))}
                  className="h-9 shrink-0 rounded-lg border border-input bg-card px-2 text-sm outline-none"
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {tc(g)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={save}
            disabled={changed === 0 || saving}
            className="touch-feedback sticky bottom-0 mt-3 h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving
              ? t('Saving…')
              : changed > 1
                ? t('Save {n} changes', { n: changed })
                : changed === 1
                  ? t('Save {n} change', { n: changed })
                  : t('No changes')}
          </button>
        </>
      )}
    </Sheet>
  )
}

/** Live viewport readout — diagnoses iOS webview sizing issues on-device. */
function ViewportDebug() {
  const [info, setInfo] = useState('')
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone
      const appH = document.documentElement.style.getPropertyValue('--app-h') || '—'
      setInfo(
        `${standalone ? 'standalone' : 'browser'} · screen ${screen.height} · inner ${window.innerHeight} · vv ${vv ? Math.round(vv.height) : '—'}+${vv ? Math.round(vv.offsetTop) : 0} · app ${appH}`,
      )
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    const id = setInterval(update, 2000)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      clearInterval(id)
    }
  }, [])
  return <p className="tnum mt-1 text-center text-[10px] text-muted-foreground/60">{info}</p>
}

interface ApiTokenInfo {
  id: number
  name: string
  scope: 'read' | 'full'
  prefix: string
  created_at: string
  last_used_at: string | null
}

function cnAccountRow(afterSso: boolean): string {
  return afterSso
    ? 'touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium hover:bg-secondary'
    : 'touch-feedback flex min-h-12 items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-secondary'
}

function cnPush(on: boolean): string {
  return on
    ? 'touch-feedback rounded-lg bg-accent-soft px-4 py-2 text-sm font-semibold text-primary'
    : 'touch-feedback rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50'
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-7">
      <h2 className="px-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {hint && <p className="mt-0.5 px-1 text-xs text-muted-foreground/80">{hint}</p>}
      <div className="mt-2 flex flex-col gap-px overflow-hidden rounded-xl border bg-card">
        {children}
      </div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth()
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme())
  const [timerSound, setTimerSound] = useState(isTimerSoundEnabled())
  const [rpe, setRpe] = useState(isRpeEnabled())
  const [restPush, setRestPush] = useState(pushEnabled())
  const [pushBusy, setPushBusy] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserAdmin, setNewUserAdmin] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [recategorizing, setRecategorizing] = useState(false)
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [serverVersion, setServerVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<{ latest: string | null; update_available: boolean } | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [upToDate, setUpToDate] = useState(false)
  const [backupInfo, setBackupInfo] = useState<{
    nightly_enabled: boolean
    keep: number
    latest: string | null
  } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const hevyInput = useRef<HTMLInputElement>(null)
  const [ssoConfig, setSsoConfig] = useState<{ enabled: boolean; button_label: string } | null>(
    null,
  )
  const [tokens, setTokens] = useState<ApiTokenInfo[]>([])
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenScope, setNewTokenScope] = useState<'full' | 'read'>('full')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [creatingToken, setCreatingToken] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')

  useEffect(() => {
    if (user?.is_admin) {
      api<User[]>('/users').then(setUsers).catch(() => {})
    }
  }, [user?.is_admin])

  useEffect(() => {
    api<{ version: string }>('/health')
      .then((h) => setServerVersion(h.version))
      .catch(() => {})
    api<{ latest: string | null; update_available: boolean }>('/update-check')
      .then(setUpdateInfo)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user?.is_admin) return
    api<{ nightly_enabled: boolean; keep: number; latest: string | null }>('/backup/settings')
      .then(setBackupInfo)
      .catch(() => {})
  }, [user?.is_admin])

  useEffect(() => {
    api<ApiTokenInfo[]>('/tokens').then(setTokens).catch(() => {})
  }, [])

  useEffect(() => {
    setWebhookUrl(user?.webhook_url ?? '')
  }, [user?.webhook_url])

  useEffect(() => {
    api<{ enabled: boolean; button_label: string }>('/auth/oidc/config')
      .then(setSsoConfig)
      .catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('sso_linked'))
      setMessage(t('SSO linked — you can sign in with it from now on'))
    if (params.get('sso_error') === 'already_linked')
      setError(t('That identity is already linked to another account'))
    if (params.get('sso_linked') || params.get('sso_error'))
      history.replaceState(null, '', window.location.pathname)
  }, [])

  if (!user) return null

  const changeTheme = (next: ThemeId) => {
    setTheme(next)
    applyTheme(next)
  }

  const checkForUpdates = async () => {
    setCheckingUpdate(true)
    setUpToDate(false)
    try {
      const info = await api<{ latest: string | null; update_available: boolean }>(
        '/update-check?force=true',
      )
      setUpdateInfo(info)
      if (!info.update_available) {
        setUpToDate(true)
        setTimeout(() => setUpToDate(false), 4000)
      }
    } catch {
      // offline or dev build — nothing to report
    }
    setCheckingUpdate(false)
  }

  const adjustRest = (delta: number) => {
    const next = Math.max(0, Math.min(600, user.default_rest_seconds + delta))
    updateUser({ default_rest_seconds: next }).catch(() => {})
  }

  const addUser = async () => {
    setError('')
    try {
      const created = await api<User>('/users', {
        method: 'POST',
        body: { username: newUsername, password: newUserPassword, is_admin: newUserAdmin },
      })
      setUsers((us) => [...us, created])
      setAddUserOpen(false)
      setNewUsername('')
      setNewUserPassword('')
      setNewUserAdmin(false)
    } catch (e) {
      setError(e instanceof Error ? tm(e.message) : t('Failed to create user'))
    }
  }

  const removeUser = async (id: number) => {
    await api(`/users/${id}`, { method: 'DELETE' })
    setUsers((us) => us.filter((u) => u.id !== id))
  }

  const importCsv = async (source: 'strong' | 'hevy', file: File) => {
    setImporting(true)
    setMessage('')
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/import/${source}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Import failed')
      setMessage(
        t(
          'Imported {workouts} workouts ({sets} sets, {exercises} new exercises, {skipped} duplicates skipped)',
          {
            workouts: data.imported_workouts,
            sets: data.imported_sets,
            exercises: data.created_exercises,
            skipped: data.skipped_workouts,
          },
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? tm(e.message) : t('Import failed'))
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
      if (hevyInput.current) hevyInput.current.value = ''
    }
  }

  const exportCsv = async () => {
    const res = await fetch('/api/export/strong', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'forge_export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const changePassword = async () => {
    setError('')
    try {
      await updateUser({ password: newPassword })
      setPasswordOpen(false)
      setNewPassword('')
      setMessage(t('Password updated'))
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? tm(e.message) : t('Failed to update password'))
    }
  }

  return (
    <div className="safe-top w-full max-w-xl px-4 pb-8">
      <header className="pt-6 pb-2">
        <h1 className="text-3xl">{t('Settings')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('Signed in as')} <span className="font-medium text-foreground">{user.username}</span>
          {user.is_admin && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-primary">
              <Shield size={11} /> {t('Admin')}
            </span>
          )}
        </p>
      </header>

      {message && <p className="mt-2 text-sm text-success">{message}</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {updateInfo?.update_available && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-accent-soft p-3.5">
          <Download size={18} className="shrink-0 text-primary" />
          <p className="text-sm">
            <span className="font-semibold">{updateInfo.latest}</span>{' '}
            {t('is available — update the container to get it (running {current}).', {
              current: serverVersion,
            })}
          </p>
        </div>
      )}

      <Section title={t('Appearance')}>
        <Row label={t('Language')}>
          <Segmented<Locale>
            options={LOCALES.map((l) => ({ value: l.id, label: l.label }))}
            value={getLocale()}
            onChange={setLocale}
            className="w-40"
          />
        </Row>
        <Row label={t('Theme')}>
          <Segmented<ThemeId>
            options={THEMES.map((th) => ({ value: th.id, label: t(`theme|${th.label}`) }))}
            value={theme}
            onChange={changeTheme}
          />
        </Row>
      </Section>

      <Section title={t('Training')}>
        <Row label={t('Unit')}>
          <Segmented<'kg' | 'lb'>
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            value={user.unit}
            onChange={(unit) => updateUser({ unit }).catch(() => {})}
            className="w-32"
          />
        </Row>
        <Row label={t('Default rest timer')}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustRest(-15)}
              className="touch-feedback rounded-lg bg-secondary p-2"
              aria-label={t('Less rest')}
            >
              <Minus size={15} />
            </button>
            <span className="tnum w-12 text-center font-semibold">
              {restLabel(user.default_rest_seconds)}
            </span>
            <button
              onClick={() => adjustRest(15)}
              className="touch-feedback rounded-lg bg-secondary p-2"
              aria-label={t('More rest')}
            >
              <Plus size={15} />
            </button>
          </div>
        </Row>
        <Row label={t('Timer sound')}>
          <Segmented<'on' | 'off'>
            options={[
              { value: 'on', label: t('On') },
              { value: 'off', label: t('Off') },
            ]}
            value={timerSound ? 'on' : 'off'}
            onChange={(v) => {
              setTimerSound(v === 'on')
              setTimerSoundEnabled(v === 'on')
            }}
            className="w-32"
          />
        </Row>
        <Row label={t('Rest alerts (lock screen)')}>
          {pushSupported() ? (
            <button
              onClick={async () => {
                setPushBusy(true)
                setError('')
                try {
                  if (restPush) {
                    await disableRestPush()
                    setRestPush(false)
                  } else {
                    const result = await enableRestPush()
                    if (result === 'enabled') setRestPush(true)
                    else if (result === 'denied')
                      setError(t('Notifications are blocked for Forge in system settings'))
                  }
                } catch {
                  setError(t('Could not set up push notifications'))
                } finally {
                  setPushBusy(false)
                }
              }}
              disabled={pushBusy}
              className={cnPush(restPush)}
            >
              {pushBusy ? t('Working…') : restPush ? t('On') : t('Enable')}
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">{t('Needs HTTPS')}</span>
          )}
        </Row>
        <Row label={t('Track RPE')}>
          <Segmented<'on' | 'off'>
            options={[
              { value: 'on', label: t('On') },
              { value: 'off', label: t('Off') },
            ]}
            value={rpe ? 'on' : 'off'}
            onChange={(v) => {
              setRpe(v === 'on')
              setRpeEnabled(v === 'on')
            }}
            className="w-32"
          />
        </Row>
        <Row label={t('Weekly goal')}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateUser({ weekly_goal: Math.max(1, user.weekly_goal - 1) }).catch(() => {})}
              className="touch-feedback rounded-lg bg-secondary p-2"
              aria-label={t('Lower goal')}
            >
              <Minus size={15} />
            </button>
            <span className="tnum w-16 text-center font-semibold">
              {t('{n}×/week', { n: user.weekly_goal })}
            </span>
            <button
              onClick={() => updateUser({ weekly_goal: Math.min(7, user.weekly_goal + 1) }).catch(() => {})}
              className="touch-feedback rounded-lg bg-secondary p-2"
              aria-label={t('Raise goal')}
            >
              <Plus size={15} />
            </button>
          </div>
        </Row>
      </Section>

      <Section
        title={t('Insights')}
        hint={t('Coaching hints computed from your history — each can be turned off.')}
      >
        <Row label={t('Training nudges')}>
          <Segmented<'on' | 'off'>
            options={[
              { value: 'on', label: t('On') },
              { value: 'off', label: t('Off') },
            ]}
            value={user.gap_nudges ? 'on' : 'off'}
            onChange={(v) => updateUser({ gap_nudges: v === 'on' }).catch(() => {})}
            className="w-32"
          />
        </Row>
        <Row label={t('Deload hints')}>
          <Segmented<'on' | 'off'>
            options={[
              { value: 'on', label: t('On') },
              { value: 'off', label: t('Off') },
            ]}
            value={user.deload_hints ? 'on' : 'off'}
            onChange={(v) => updateUser({ deload_hints: v === 'on' }).catch(() => {})}
            className="w-32"
          />
        </Row>
        <Row label={t('Weekly digest')} hint={t('Sunday-evening push: volume, goal, PRs')}>
          <Segmented<'on' | 'off'>
            options={[
              { value: 'on', label: t('On') },
              { value: 'off', label: t('Off') },
            ]}
            value={user.weekly_digest ? 'on' : 'off'}
            onChange={(v) => updateUser({ weekly_digest: v === 'on' }).catch(() => {})}
            className="w-32"
          />
        </Row>
        <Row
          label={t('Weigh-in reminder')}
          hint={t('Daily push — quiet on days a weight is already logged')}
        >
          <Segmented<'on' | 'off'>
            options={[
              { value: 'on', label: t('On') },
              { value: 'off', label: t('Off') },
            ]}
            value={user.weigh_in_reminder ? 'on' : 'off'}
            onChange={(v) => updateUser({ weigh_in_reminder: v === 'on' }).catch(() => {})}
            className="w-32"
          />
        </Row>
        {user.weigh_in_reminder && (
          <Row label={t('Reminder time')}>
            <select
              value={Math.round(user.weigh_in_hour - new Date().getTimezoneOffset() / 60 + 24) % 24}
              onChange={(e) =>
                updateUser({
                  weigh_in_hour:
                    Math.round(
                      Number(e.target.value) + new Date().getTimezoneOffset() / 60 + 24,
                    ) % 24,
                }).catch(() => {})
              }
              className="tnum rounded-lg border bg-background px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Row>
        )}
      </Section>

      <Section title={t('Data')} hint={t('Imports, exports and database backups.')}>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          className="touch-feedback flex min-h-12 items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Upload size={18} className="text-muted-foreground" />
          {importing ? t('Importing…') : t('Import from Strong (CSV)')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importCsv('strong', file)
          }}
        />
        <button
          onClick={() => hevyInput.current?.click()}
          disabled={importing}
          className="touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Upload size={18} className="text-muted-foreground" />
          {importing ? t('Importing…') : t('Import from Hevy (CSV)')}
        </button>
        <input
          ref={hevyInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importCsv('hevy', file)
          }}
        />
        <button
          onClick={exportCsv}
          className="touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium hover:bg-secondary"
        >
          <Download size={18} className="text-muted-foreground" /> {t('Export workouts (CSV)')}
        </button>
        <button
          onClick={() => setRecategorizing(true)}
          className="touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium hover:bg-secondary"
        >
          <Tags size={18} className="text-muted-foreground" /> {t('Re-categorize exercises')}
        </button>
        {user.is_admin && (
          <button
            onClick={async () => {
              const res = await fetch('/api/backup', {
                headers: { Authorization: `Bearer ${getToken()}` },
              })
              if (!res.ok) return
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = res.headers.get('content-disposition')?.match(/filename="?([^";]+)/)?.[1] ?? 'forge-backup.db'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium hover:bg-secondary"
          >
            <DatabaseBackup size={18} className="text-muted-foreground" />{' '}
            {t('Download database backup')}
          </button>
        )}
        {user.is_admin && backupInfo && (
          <div className="border-t">
            <Row label={t('Nightly backups')}>
              <Segmented<'on' | 'off'>
                options={[
                  { value: 'on', label: t('On') },
                  { value: 'off', label: t('Off') },
                ]}
                value={backupInfo.nightly_enabled ? 'on' : 'off'}
                onChange={(v) => {
                  const nightly_enabled = v === 'on'
                  setBackupInfo({ ...backupInfo, nightly_enabled })
                  api('/backup/settings', { method: 'PUT', body: { nightly_enabled } }).catch(() =>
                    toast(t('Could not save the backup setting')),
                  )
                }}
                className="w-32"
              />
            </Row>
            <p className="px-4 pb-3 text-xs text-muted-foreground">
              {t('Daily snapshot to {path}, keeping the last {keep}.', {
                path: '/data/backups',
                keep: backupInfo.keep,
              })}
              {backupInfo.latest && (
                <>
                  {' '}
                  {t('Latest:')} <span className="tnum">{backupInfo.latest}</span>
                </>
              )}
            </p>
          </div>
        )}
      </Section>

      <Section
        title={t('API')}
        hint={t('Tokens and webhooks for scripting Forge — guide in docs/api.md.')}
      >
        {tokens.map((token, i) => (
          <div
            key={token.id}
            className={
              'flex min-h-12 items-center justify-between gap-3 px-4 py-2.5' +
              (i > 0 ? ' border-t' : '')
            }
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{token.name}</span>
                <span
                  className={
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
                    (token.scope === 'read'
                      ? 'bg-secondary text-muted-foreground'
                      : 'bg-accent-soft text-primary')
                  }
                >
                  {token.scope === 'read' ? t('read-only') : t('full access')}
                </span>
              </div>
              <p className="tnum mt-0.5 text-xs text-muted-foreground">
                {token.prefix}… ·{' '}
                {token.last_used_at
                  ? t('used {when}', { when: formatRelativeDate(token.last_used_at) })
                  : t('never used')}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await api(`/tokens/${token.id}`, { method: 'DELETE' })
                  setTokens((ts) => ts.filter((x) => x.id !== token.id))
                } catch {
                  toast(t('Could not delete the token'))
                }
              }}
              className="touch-feedback shrink-0 rounded-full p-2 text-muted-foreground"
              aria-label={t('Delete token {name}', { name: token.name })}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            setNewTokenName('')
            setNewTokenScope('full')
            setCreatedToken(null)
            setTokenSheetOpen(true)
          }}
          className={
            'touch-feedback flex min-h-12 items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-secondary' +
            (tokens.length > 0 ? ' border-t' : '')
          }
        >
          <KeyRound size={18} className="text-muted-foreground" /> {t('Create API token')}
        </button>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium hover:bg-secondary"
        >
          <BookOpen size={18} className="text-muted-foreground" /> {t('API documentation')}
        </a>
        <div className="border-t px-4 py-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Webhook size={16} className="text-muted-foreground" />{' '}
              {t('Webhook on workout finish')}
            </span>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              onBlur={() => {
                const url = webhookUrl.trim()
                if (url === (user.webhook_url ?? '')) return
                updateUser({ webhook_url: url || null }).then(
                  () => setMessage(url ? t('Webhook saved') : t('Webhook removed')),
                  () => setError(t('Webhook URL must be http(s)')),
                )
              }}
              placeholder="https://n8n.example.com/webhook/forge"
              inputMode="url"
              autoCapitalize="none"
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              onBlur={() => {
                if (!webhookSecret) return
                updateUser({ webhook_secret: webhookSecret }).then(
                  () => {
                    setWebhookSecret('')
                    setMessage(t('Signing secret saved'))
                  },
                  () => setError(t('Could not save the secret')),
                )
              }}
              placeholder={t('Signing secret (optional, write-only)')}
              autoCapitalize="none"
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs font-normal text-muted-foreground">
              {t(
                'POSTs a JSON summary when you finish a workout; the secret adds an X-Forge-Signature HMAC header.',
              )}
            </span>
          </label>
        </div>
      </Section>

      {user.is_admin && (
        <Section title={t('Users')}>
          {users.map((u) => (
            <div key={u.id} className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
              <span className="font-medium">
                {u.username}
                {u.is_admin && (
                  <span className="ml-2 text-xs font-semibold text-primary">{t('admin')}</span>
                )}

      <Section title={t('Account')}>
        {ssoConfig?.enabled && (
          <button
            onClick={async () => {
              if (user.oidc_linked) {
                try {
                  await api('/auth/oidc/unlink', { method: 'POST' })
                  await updateUser({})
                  setMessage(t('SSO unlinked'))
                } catch {
                  setError(t('Could not unlink SSO'))
                }
              } else {
                try {
                  await api('/auth/oidc/link/start', { method: 'POST' })
                  window.location.href = '/api/auth/oidc/login'
                } catch {
                  setError(t('Could not start SSO linking'))
                }
              }
            }}
            className="touch-feedback flex min-h-12 items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-secondary"
          >
            <Shield size={18} className="text-muted-foreground" />
            {user.oidc_linked ? t('Unlink SSO sign-in') : t('Link SSO sign-in')}
          </button>
        )}
        <button
          onClick={() => setPasswordOpen(true)}
          className={cnAccountRow(ssoConfig?.enabled ?? false)}
        >
          <KeyRound size={18} className="text-muted-foreground" /> {t('Change password')}
        </button>
        <button
          onClick={logout}
          className="touch-feedback flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-left font-medium text-destructive hover:bg-secondary"
        >
          <LogOut size={18} /> {t('Sign out')}
        </button>
      </Section>
              </span>
              {u.id !== user.id && (
                <span className="flex items-center">
                  <button
                    onClick={() => {
                      setResetTarget(u)
                      setResetPassword('')
                      setError('')
                    }}
                    className="touch-feedback rounded-full p-2 text-muted-foreground"
                    aria-label={t('Reset password for {name}', { name: u.username })}
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteUserTarget(u)}
                    className="touch-feedback rounded-full p-2 text-muted-foreground"
                    aria-label={t('Delete {name}', { name: u.username })}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              )}
            </div>
          ))}
          <button
            onClick={() => setAddUserOpen(true)}
            className="touch-feedback flex min-h-12 items-center gap-3 px-4 py-2.5 text-left font-medium text-primary hover:bg-secondary"
          >
            <UserPlus size={18} /> {t('Add user')}
          </button>
        </Section>
      )}

      <Sheet
        open={resetTarget != null}
        onClose={() => setResetTarget(null)}
        title={t('Reset password — {name}', { name: resetTarget?.username ?? '' })}
      >
        <div className="flex flex-col gap-3 pt-1">
          <input
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder={t('New password (min 8 characters)')}
            className="h-12 rounded-lg border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={async () => {
              setError('')
              try {
                await api(`/users/${resetTarget!.id}/password`, {
                  method: 'PATCH',
                  body: { password: resetPassword },
                })
                setResetTarget(null)
                setMessage(t('Password reset for {name}', { name: resetTarget!.username }))
                setTimeout(() => setMessage(''), 3000)
              } catch (e) {
                setError(e instanceof Error ? tm(e.message) : t('Failed to reset password'))
              }
            }}
            disabled={resetPassword.length < 8}
            className="touch-feedback h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t('Reset password')}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={tokenSheetOpen}
        onClose={() => setTokenSheetOpen(false)}
        title={createdToken ? t('Token created') : t('Create API token')}
      >
        {createdToken ? (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-sm text-muted-foreground">
              {t('Copy it now — this is the only time it’s shown.')}
            </p>
            <code className="tnum rounded-lg border bg-secondary/60 p-3 text-xs break-all select-all">
              {createdToken}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(createdToken)
                  setMessage(t('Token copied'))
                  setTimeout(() => setMessage(''), 2500)
                } catch {
                  toast(t('Copy failed — select it manually'))
                }
              }}
              className="touch-feedback flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"
            >
              <Copy size={17} /> {t('Copy token')}
            </button>
            <button
              onClick={() => setTokenSheetOpen(false)}
              className="touch-feedback h-12 rounded-xl bg-secondary font-semibold text-secondary-foreground"
            >
              {t('Done')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            <input
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder={t('Name (e.g. grafana, n8n)')}
              autoCapitalize="none"
              className="h-12 rounded-lg border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
            />
            <Segmented<'full' | 'read'>
              options={[
                { value: 'full', label: t('Full access') },
                { value: 'read', label: t('Read-only') },
              ]}
              value={newTokenScope}
              onChange={setNewTokenScope}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'Read-only tokens can fetch workouts, stats, exports and metrics but can’t change anything — safe for dashboards.',
              )}
            </p>
            <button
              onClick={async () => {
                setCreatingToken(true)
                try {
                  const created = await api<ApiTokenInfo & { token: string }>('/tokens', {
                    method: 'POST',
                    body: { name: newTokenName.trim(), scope: newTokenScope },
                  })
                  setTokens((ts) => [...ts, created])
                  setCreatedToken(created.token)
                } catch (e) {
                  setError(e instanceof Error ? tm(e.message) : t('Could not create the token'))
                  setTokenSheetOpen(false)
                } finally {
                  setCreatingToken(false)
                }
              }}
              disabled={!newTokenName.trim() || creatingToken}
              className="touch-feedback h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creatingToken ? t('Creating…') : t('Create token')}
            </button>
          </div>
        )}
      </Sheet>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Forge {serverVersion && serverVersion !== 'dev' ? serverVersion : ''} ·{' '}
        {t('self-hosted iron tracking')} · {t('build {build}', { build: __BUILD__ })}
      </p>
      <button
        onClick={checkForUpdates}
        disabled={checkingUpdate}
        className="touch-feedback mx-auto mt-1 block rounded-md px-3 py-1.5 text-center text-xs font-medium text-primary"
      >
        {checkingUpdate
          ? t('Checking…')
          : updateInfo?.update_available
            ? t('{version} is available', { version: updateInfo.latest ?? '' })
            : upToDate
              ? t('You’re on the latest version')
              : t('Check for updates')}
      </button>
      <ViewportDebug />

      <ConfirmSheet
        open={deleteUserTarget != null}
        onClose={() => setDeleteUserTarget(null)}
        title={t('Delete {name}?', { name: deleteUserTarget?.username ?? '' })}
        message={t(
          'This permanently deletes the account with all of its workouts, templates, and history.',
        )}
        actionLabel={t('Delete user')}
        destructive
        onConfirm={() => {
          if (deleteUserTarget) removeUser(deleteUserTarget.id)
          setDeleteUserTarget(null)
        }}
      />

      <RecategorizeSheet open={recategorizing} onClose={() => setRecategorizing(false)} />

      <Sheet open={addUserOpen} onClose={() => setAddUserOpen(false)} title={t('Add user')}>
        <div className="flex flex-col gap-3 pt-1">
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder={t('Username')}
            autoCapitalize="none"
            className="h-12 rounded-lg border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            placeholder={t('Password (min 8 characters)')}
            className="h-12 rounded-lg border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="flex items-center gap-2 px-1 text-sm font-medium">
            <input
              type="checkbox"
              checked={newUserAdmin}
              onChange={(e) => setNewUserAdmin(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            {t('Admin')}
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={addUser}
            disabled={!newUsername.trim() || newUserPassword.length < 8}
            className="touch-feedback h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t('Create user')}
          </button>
        </div>
      </Sheet>

      <Sheet open={passwordOpen} onClose={() => setPasswordOpen(false)} title={t('Change password')}>
        <div className="flex flex-col gap-3 pt-1">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('New password (min 8 characters)')}
            className="h-12 rounded-lg border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={changePassword}
            disabled={newPassword.length < 8}
            className="touch-feedback h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t('Update password')}
          </button>
        </div>
      </Sheet>
    </div>
  )
}
