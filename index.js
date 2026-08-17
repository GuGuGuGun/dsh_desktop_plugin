import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'
import Schema from '@deepseek-ai/schemastery'

export const name = 'desktop-shell'
export const inject = ['webServer', 'webRuntime']

export const Config = Schema.object({
  width: Schema.natural().min(800).max(7680).default(1280),
  height: Schema.natural().min(600).max(4320).default(840),
  startupTimeoutMs: Schema.natural().min(1000).max(120000).default(15000),
  startMaximized: Schema.boolean().default(false),
  openDevTools: Schema.boolean().default(false),
  exitHarnessOnClose: Schema.boolean().default(true),
})

const desktopApp = fileURLToPath(new URL('./desktop', import.meta.url))
const defaultRuntime = {
  electronPath,
  spawnProcess: spawn,
  stopHarness: () => process.kill(process.pid, 'SIGTERM'),
}

export function harnessUrl(webServer) {
  const port = webServer?.port
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`desktop-shell: invalid webServer port ${String(port)}`)
  }
  return `http://127.0.0.1:${String(port)}/`
}

export function desktopArguments(url, config) {
  const payload = Buffer.from(JSON.stringify({
    url,
    width: config.width,
    height: config.height,
    startupTimeoutMs: config.startupTimeoutMs,
    startMaximized: config.startMaximized,
    openDevTools: config.openDevTools,
  }), 'utf8').toString('base64url')
  return [
    desktopApp,
    payload,
  ]
}

export function mountDesktop(ctx, config, runtime = defaultRuntime) {
  ctx.effect(() => {
    const child = runtime.spawnProcess(
      runtime.electronPath,
      desktopArguments(harnessUrl(ctx.webServer), config),
      { shell: false, stdio: ['ignore', 'inherit', 'inherit'] },
    )
    let disposing = false
    let stopRequested = false
    const stopHarness = () => {
      if (disposing || stopRequested) return
      stopRequested = true
      runtime.stopHarness()
    }
    child.once('error', (error) => {
      ctx.logger.error(error)
      stopHarness()
    })
    child.once('exit', (code) => {
      if (code !== 0 && code !== null) {
        ctx.logger.error(new Error(`desktop-shell: Electron exited with code ${String(code)}`))
      }
      if (config.exitHarnessOnClose || (code !== 0 && code !== null)) stopHarness()
    })
    return () => {
      disposing = true
      if (child.exitCode === null && child.signalCode === null) child.kill()
    }
  })
}

export function apply(ctx, config) {
  mountDesktop(ctx, config)
}
