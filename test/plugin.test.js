import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { after, before, test } from 'node:test'
import { desktopArguments, harnessUrl, mountDesktop } from '../index.js'

const require = createRequire(import.meta.url)
const { applyWindowAction, isHarnessOrigin, parseDesktopOptions, waitForHarness } = require('../desktop/main.cjs')

const config = {
  width: 1280,
  height: 840,
  startupTimeoutMs: 15000,
  startMaximized: false,
  openDevTools: false,
  exitHarnessOnClose: true,
}

test('builds a loopback URL from the bound Harness port', () => {
  assert.equal(harnessUrl({ port: 3080 }), 'http://127.0.0.1:3080/')
  assert.throws(() => harnessUrl({ port: 0 }), /invalid webServer port/)
})

test('passes validated window settings without a shell', () => {
  const child = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
    killCalled: false,
    kill() { this.killCalled = true },
  })
  let spawnCall
  let disposer
  let stopCount = 0
  const ctx = {
    webServer: { port: 3080 },
    logger: { error() {} },
    effect(factory) { disposer = factory() },
  }
  mountDesktop(ctx, config, {
    electronPath: 'electron',
    spawnProcess(...args) { spawnCall = args; return child },
    stopHarness() { stopCount += 1 },
  })

  assert.equal(spawnCall[0], 'electron')
  assert.equal(spawnCall[2].shell, false)
  assert.equal(spawnCall[2].windowsHide, undefined)
  assert.deepEqual(spawnCall[1], desktopArguments('http://127.0.0.1:3080/', config))
  child.emit('exit', 0)
  assert.equal(stopCount, 1)
  disposer()
  assert.equal(child.killCalled, true)
})

test('parses only loopback desktop targets', () => {
  const options = parseDesktopOptions(desktopArguments('http://127.0.0.1:3080/', config).slice(1))
  assert.equal(options.url.origin, 'http://127.0.0.1:3080')
  const externalTarget = desktopArguments('https://example.com', config).slice(1)
  assert.throws(() => parseDesktopOptions(externalTarget), /must use unauthenticated/)
  assert.throws(() => parseDesktopOptions(['not-json']), /payload is invalid/)
  assert.equal(isHarnessOrigin('/settings', options.url.origin), false)
  assert.equal(isHarnessOrigin('http://127.0.0.1:3080/settings', options.url.origin), true)
})

test('handles only supported custom window actions', () => {
  const calls = []
  let maximized = false
  const window = {
    minimize() { calls.push('minimize') },
    isMaximized() { return maximized },
    maximize() { maximized = true; calls.push('maximize') },
    unmaximize() { maximized = false; calls.push('unmaximize') },
    close() { calls.push('close') },
  }

  assert.equal(applyWindowAction(window, 'minimize'), true)
  assert.equal(applyWindowAction(window, 'toggle-maximize'), true)
  assert.equal(applyWindowAction(window, 'toggle-maximize'), true)
  assert.equal(applyWindowAction(window, 'close'), true)
  assert.equal(applyWindowAction(window, 'unknown'), false)
  assert.deepEqual(calls, ['minimize', 'maximize', 'unmaximize', 'close'])
})

let server
let serverUrl

before(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ready')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  serverUrl = new URL(`http://127.0.0.1:${String(server.address().port)}/`)
})

after(async () => {
  await new Promise(resolve => server.close(resolve))
})

test('waits for a reachable Harness endpoint', async () => {
  await waitForHarness(serverUrl, 1000)
})
