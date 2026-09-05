/** Rest timer singleton — survives reloads via localStorage, ticks subscribers,
 *  and fires sound + vibration + notification when time is up. */
import { useEffect, useState } from 'react'
import { t } from './i18n'
import { syncRestPush } from './push'
import alertUrl from '../assets/rest-alert.wav'
import silenceUrl from '../assets/rest-silence.wav'

const TIMER_KEY = 'forge_rest_timer'
const SOUND_KEY = 'forge_timer_sound'

export function isTimerSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

export function setTimerSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  if (on) prepareTimerAudio()
  else stopTimerAudio()
}

// HTML media playback uses iOS's media channel, which ignores the Ring/Silent
// switch. Web Audio's default ambient channel obeys it, even when running.
let timerAudio: HTMLAudioElement | null = null
let audioPrepared = false
let preparingAudio = false
let playbackVersion = 0
let playbackTimeout: ReturnType<typeof setTimeout> | null = null

function stopTimerAudio() {
  playbackVersion++
  if (playbackTimeout != null) clearTimeout(playbackTimeout)
  playbackTimeout = null
  timerAudio?.pause()
  preparingAudio = false
}

/** Call synchronously from a user gesture, before any async save. Reuse the
 * same media element: Safari grants playback permission per element. The
 * short silent file primes it without muting the element or looping audio. */
export function prepareTimerAudio() {
  if (!isTimerSoundEnabled() || audioPrepared || preparingAudio) return
  if (navigator.userActivation && !navigator.userActivation.isActive) return
  try {
    timerAudio ??= new window.Audio()
    const audio = timerAudio
    audio.preload = 'auto'
    audio.src = silenceUrl
    preparingAudio = true
    const version = ++playbackVersion
    void audio.play().then(() => {
      if (version !== playbackVersion) return
      audio.pause()
      audioPrepared = true
      preparingAudio = false
      // Fetch the actual alert during the countdown, not at its deadline.
      audio.src = alertUrl
      audio.load()
    }).catch(() => {
      if (version === playbackVersion) preparingAudio = false
    })
  } catch {
    preparingAudio = false
    // Audio is optional; unsupported browsers must still start the timer.
  }
}

export interface TimerState {
  endsAt: number
  total: number
}

type Listener = () => void

let state: TimerState | null = null
let interval: ReturnType<typeof setInterval> | null = null
let lastNaturalEnd = 0 // natural completion (not skip) — drives the "go!" state
const listeners = new Set<Listener>()

function load() {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TimerState
      if (parsed.endsAt > Date.now()) {
        state = parsed
        ensureTicking()
      } else {
        localStorage.removeItem(TIMER_KEY)
      }
    }
  } catch {
    localStorage.removeItem(TIMER_KEY)
  }
}

function persist() {
  if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state))
  else localStorage.removeItem(TIMER_KEY)
}

function notify() {
  listeners.forEach((l) => l())
}

function ensureTicking() {
  if (interval == null) {
    interval = setInterval(tick, 250)
  }
}

function stopTicking() {
  if (interval != null) {
    clearInterval(interval)
    interval = null
  }
}

function tick() {
  if (!state) {
    stopTicking()
    return
  }
  if (state.endsAt <= Date.now()) {
    state = null
    lastNaturalEnd = Date.now()
    persist()
    stopTicking()
    fireDone()
  }
  notify()
}

function fireDone() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400])
  } catch {
    // vibration unsupported
  }
  beep()
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(t('Rest over'), { body: t('Time for your next set.') })
    } catch {
      // notification construction can throw on some platforms
    }
  }
}

function beep() {
  if (!isTimerSoundEnabled() || !timerAudio) return
  stopTimerAudio()
  const audio = timerAudio
  const version = playbackVersion
  try {
    if (audio.getAttribute('src') !== alertUrl) audio.src = alertUrl
    audio.currentTime = 0
    // Cancel a pending play as well as active playback, so an alarm blocked
    // by browser policy cannot unexpectedly sound on a much later gesture.
    playbackTimeout = setTimeout(() => {
      if (version === playbackVersion) stopTimerAudio()
    }, 5000)
    void audio.play().catch(() => {
      if (version !== playbackVersion) return
      audioPrepared = false
      stopTimerAudio()
    })
  } catch {
    audioPrepared = false
    stopTimerAudio()
  }
}

export const restTimer = {
  start(seconds: number) {
    if (seconds <= 0) return
    if (!preparingAudio) stopTimerAudio()
    prepareTimerAudio()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    state = { endsAt: Date.now() + seconds * 1000, total: seconds }
    persist()
    ensureTicking()
    notify()
    syncRestPush(state.endsAt) // lock-screen alert via server push (HTTPS only)
  },
  adjust(deltaSeconds: number) {
    if (!state) return
    prepareTimerAudio()
    const remaining = Math.max(0, state.endsAt - Date.now()) / 1000
    const next = Math.max(1, remaining + deltaSeconds)
    state = { endsAt: Date.now() + next * 1000, total: Math.max(state.total + deltaSeconds, next) }
    persist()
    notify()
    syncRestPush(state.endsAt)
  },
  skip() {
    stopTimerAudio()
    state = null
    persist()
    stopTicking()
    notify()
    syncRestPush(null)
  },
  get(): { remaining: number; total: number } | null {
    if (!state) return null
    return { remaining: Math.max(0, (state.endsAt - Date.now()) / 1000), total: state.total }
  },
  lastNaturalEnd(): number {
    return lastNaturalEnd
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

load()

// A restored timer also needs a gesture after reload; keep retrying after
// interruptions instead of treating the first unlock as permanent.
document.addEventListener('click', () => {
  if (state) prepareTimerAudio()
})
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state) {
    prepareTimerAudio()
    tick()
  }
})

export function useRestTimer() {
  const [, setVersion] = useState(0)
  useEffect(() => restTimer.subscribe(() => setVersion((v) => v + 1)), [])
  return restTimer.get()
}
