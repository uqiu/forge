import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/timer.ts', import.meta.url), 'utf8')
const compile = (text) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

// These mocks verify scheduling and cancellation, not iOS's physical audio
// routing. Silent-switch behavior requires an iPhone test.
function setup({ restored = false, supported = true } = {}) {
  let now = 10000
  let gesture = false
  let interval
  const players = []
  const alarms = []
  const events = {}
  const timeouts = new Map()
  let timeoutId = 0
  const storage = new Map(restored ? [
    ['forge_rest_timer', JSON.stringify({ endsAt: 11000, total: 1 })],
  ] : [])
  class Audio {
    src = ''
    currentTime = 0
    unlocked = false
    paused = true
    pending = false
    muted = false
    constructor() { players.push(this) }
    getAttribute(name) { return this[name] }
    load() {}
    play() {
      if (gesture) this.unlocked = true
      if (!this.unlocked) return Promise.reject(new Error('User gesture required'))
      this.paused = false
      if (this.src === 'alert.wav') alarms.push(this)
      return Promise.resolve()
    }
    pause() { this.paused = true; this.pending = false }
  }
  const sandbox = {
    exports: {},
    require(name) {
      if (name === 'react') return { useEffect() {}, useState() {} }
      if (name === './i18n') return { t: (s) => s }
      if (name === './push') return { syncRestPush() {} }
      if (name.endsWith('rest-alert.wav')) return { default: 'alert.wav' }
      if (name.endsWith('rest-silence.wav')) return { default: 'silence.wav' }
      throw new Error(`Unexpected import: ${name}`)
    },
    window: supported ? { Audio } : {},
    navigator: { userActivation: { get isActive() { return gesture } } },
    document: { hidden: false, addEventListener(name, fn) { events[name] = fn } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    Date: { now: () => now },
    setInterval(fn) { interval = fn; return 1 },
    clearInterval() { interval = undefined },
    setTimeout(fn, ms) { const id = ++timeoutId; timeouts.set(id, { fn, at: now + ms }); return id },
    clearTimeout(id) { timeouts.delete(id) },
  }
  vm.runInNewContext(compile(source), sandbox)
  return {
    ...sandbox.exports, players, alarms, events,
    click(fn) { gesture = true; try { fn() } finally { gesture = false } },
    advance(ms, tick = true) {
      now += ms
      for (const [id, timeout] of timeouts) {
        if (timeout.at <= now) { timeouts.delete(id); timeout.fn() }
      }
      if (tick) interval?.()
    },
  }
}

test('gesture primes unmuted media silently and reuses it for subsequent alarms', async () => {
  const h = setup()
  h.click(() => h.prepareTimerAudio())
  assert.equal(h.players[0].src, 'silence.wav')
  assert.equal(h.players[0].muted, false)
  assert.equal(h.alarms.length, 0)
  await Promise.resolve()
  h.restTimer.start(1)
  h.advance(1000)
  assert.equal(h.alarms.length, 1)
  h.restTimer.start(1)
  assert.equal(h.players[0].paused, true)
  h.advance(1000)
  assert.equal(h.alarms.length, 2)
  assert.equal(h.players.length, 1)
})

test('muting and skipping suppress alarms and stop active playback', async () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  await Promise.resolve()
  h.setTimerSoundEnabled(false)
  h.advance(1000)
  assert.equal(h.alarms.length, 0)
  h.click(() => h.setTimerSoundEnabled(true))
  h.restTimer.start(1)
  h.restTimer.skip()
  h.advance(1000)
  assert.equal(h.alarms.length, 0)
  h.restTimer.start(1)
  h.advance(1000)
  assert.equal(h.players[0].paused, false)
  h.setTimerSoundEnabled(false)
  assert.equal(h.players[0].paused, true)
})

test('adjustment changes the deadline without firing twice', async () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  await Promise.resolve()
  h.restTimer.adjust(1)
  h.advance(1000)
  assert.equal(h.alarms.length, 0)
  h.advance(1000)
  h.advance(1000)
  assert.equal(h.alarms.length, 1)
})

test('restored timer unlocks on interaction and catches up on foregrounding', async () => {
  const h = setup({ restored: true })
  h.click(() => h.events.click())
  await Promise.resolve()
  h.advance(1000, false)
  h.events.visibilitychange()
  assert.equal(h.alarms.length, 1)
})

test('unsupported audio does not prevent timer completion', () => {
  const h = setup({ supported: false })
  h.click(() => h.restTimer.start(1))
  h.advance(1000)
  assert.equal(h.restTimer.get(), null)
  assert.equal(h.restTimer.lastNaturalEnd(), 11000)
})

test('pending playback is cancelled after five seconds', async () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  await Promise.resolve()
  const player = h.players[0]
  player.play = () => { player.pending = true; return new Promise(() => {}) }
  h.advance(1000)
  assert.equal(player.pending, true)
  h.advance(5000)
  assert.equal(player.pending, false)
  assert.equal(player.paused, true)
})

test('late priming completion cannot pause or replace a newer alarm', async () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  h.advance(1000)
  await Promise.resolve()
  assert.equal(h.players[0].src, 'alert.wav')
  assert.equal(h.players[0].paused, false)
})

test('rejected playback can be primed again on the next gesture', async () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  await Promise.resolve()
  h.players[0].unlocked = false
  h.advance(1000)
  await Promise.resolve()
  h.click(() => h.restTimer.start(1))
  await Promise.resolve()
  h.advance(1000)
  assert.equal(h.alarms.length, 1)
})

test('the workout handler unlocks audio before awaiting the set save', async () => {
  const page = readFileSync(new URL('../src/pages/ActiveWorkoutPage.tsx', import.meta.url), 'utf8')
  const tree = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let handler
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'completeSet') handler = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(handler)
  const h = setup()
  let finishSave
  const sandbox = {
    prepareTimerAudio: h.prepareTimerAudio,
    restTimer: h.restTimer,
    updateSet: () => new Promise((resolve) => { finishSave = resolve }),
    user: { default_rest_seconds: 1 },
  }
  vm.runInNewContext(compile(`const completeSet = ${handler.getText(tree)}; globalThis.handler = completeSet`), sandbox)
  let completion
  h.click(() => { completion = sandbox.handler({}, 1, 20, 10) })
  assert.equal(h.players[0]?.unlocked, true)
  assert.equal(h.restTimer.get(), null)
  finishSave()
  await completion
  h.advance(1000)
  assert.equal(h.alarms.length, 1)
})

for (const focused of [true, false]) {
  test(`push displays a notification when the window is ${focused ? 'focused' : 'in the background'}`, async () => {
    const events = {}
    const shown = []
    let closed = 0
    const worker = {
      __WB_MANIFEST: [],
      addEventListener(name, fn) { events[name] = fn },
      clients: { matchAll: async () => [{ focused }] },
      registration: {
        getNotifications: async () => [{ close() { closed++ } }],
        showNotification: async (...args) => { shown.push(args) },
      },
    }
    const stubs = {
      'workbox-precaching': { precacheAndRoute() {}, createHandlerBoundToURL() {} },
      'workbox-routing': { NavigationRoute: class {}, registerRoute() {} },
      'workbox-strategies': { CacheFirst: class {} },
    }
    const sw = readFileSync(new URL('../src/sw.ts', import.meta.url), 'utf8')
    vm.runInNewContext(compile(sw), { exports: {}, self: worker, require: (name) => stubs[name] })
    let finished
    events.push({
      data: { json: () => ({ title: 'Rest over', body: 'Next set' }) },
      waitUntil(promise) { finished = promise },
    })
    await finished
    assert.equal(shown.length, 1)
    assert.equal(shown[0][0], 'Rest over')
    assert.equal(closed, 1)
    assert.equal(shown[0][1].silent, undefined)
    assert.equal(shown[0][1].tag, undefined)
  })
}
