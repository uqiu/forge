import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/timer.ts', import.meta.url), 'utf8')
const compile = (text) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function setup({ restored = false, supported = true } = {}) {
  let now = 10000
  let gesture = false
  let interval
  const contexts = []
  const tones = []
  const events = {}
  const storage = new Map(restored ? [
    ['forge_rest_timer', JSON.stringify({ endsAt: 11000, total: 1 })],
  ] : [])
  class AudioContext {
    state = 'suspended'
    currentTime = 0
    destination = {}
    constructor() { contexts.push(this) }
    resume() {
      if (!gesture) return Promise.reject(new Error('User gesture required'))
      this.state = 'running'
      return Promise.resolve()
    }
    createOscillator() {
      const ctx = this
      return {
        frequency: {},
        connect(gain) { return gain },
        disconnect() {},
        start() { if (ctx.state === 'running') tones.push(this.frequency.value) },
        stop() { this.onended?.() },
      }
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() {},
      }
    }
  }
  const sandbox = {
    exports: {},
    require(name) {
      if (name === 'react') return { useEffect() {}, useState() {} }
      if (name === './i18n') return { t: (s) => s }
      if (name === './push') return { syncRestPush() {} }
      throw new Error(`Unexpected import: ${name}`)
    },
    window: supported ? { AudioContext } : {},
    navigator: {},
    document: { hidden: false, addEventListener(name, fn) { events[name] = fn } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    Date: { now: () => now },
    setInterval(fn) { interval = fn; return 1 },
    clearInterval() { interval = undefined },
  }
  vm.runInNewContext(compile(source), sandbox)
  return {
    ...sandbox.exports, contexts, tones, events,
    click(fn) { gesture = true; try { fn() } finally { gesture = false } },
    advance(ms, tick = true) { now += ms; if (tick) interval?.() },
  }
}

test('a gesture unlocks audio for asynchronous completion and subsequent timers', () => {
  const h = setup()
  h.click(() => h.prepareTimerAudio())
  h.restTimer.start(1) // after the async save, outside the gesture
  h.advance(1000)
  assert.deepEqual(h.tones, [880, 880, 1175])
  h.restTimer.start(1)
  h.advance(1000)
  assert.equal(h.tones.length, 6)
  assert.equal(h.contexts.length, 1)
})

test('muting and skipping suppress the alarm', () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  h.setTimerSoundEnabled(false)
  h.advance(1000)
  assert.equal(h.tones.length, 0)
  h.click(() => h.setTimerSoundEnabled(true))
  h.restTimer.start(1)
  h.restTimer.skip()
  h.advance(1000)
  assert.equal(h.tones.length, 0)
})

test('adjustment changes the deadline without firing twice', () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  h.restTimer.adjust(1)
  h.advance(1000)
  assert.equal(h.tones.length, 0)
  h.advance(1000)
  h.advance(1000)
  assert.equal(h.tones.length, 3)
})

test('a restored timer unlocks on interaction and catches up on foregrounding', () => {
  const h = setup({ restored: true })
  h.click(() => h.events.click())
  h.contexts[0].state = 'interrupted'
  h.click(() => h.events.click())
  h.advance(1000, false) // iOS may suspend interval callbacks in the background
  h.events.visibilitychange()
  assert.equal(h.contexts[0].state, 'running')
  assert.equal(h.tones.length, 3)
})

test('unsupported audio does not prevent timer completion', () => {
  const h = setup({ supported: false })
  h.click(() => h.restTimer.start(1))
  h.advance(1000)
  assert.equal(h.restTimer.get(), null)
  assert.equal(h.restTimer.lastNaturalEnd(), 11000)
})

test('a delayed audio resume does not replay a stale alarm', async () => {
  const h = setup()
  h.click(() => h.restTimer.start(1))
  const ctx = h.contexts[0]
  ctx.state = 'interrupted'
  let resolve
  ctx.resume = () => new Promise((done) => { resolve = done })
  h.advance(1000)
  h.advance(6000)
  ctx.state = 'running'
  resolve()
  await Promise.resolve()
  assert.equal(h.tones.length, 0)
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
  assert.equal(h.contexts[0]?.state, 'running')
  assert.equal(h.restTimer.get(), null)
  finishSave()
  await completion
  h.advance(1000)
  assert.equal(h.tones.length, 3)
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
