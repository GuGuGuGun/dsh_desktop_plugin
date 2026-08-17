const path = require('node:path')

const allowedPermissions = new Set(['clipboard-read', 'clipboard-sanitized-write'])
const optionNames = new Set([
  'url',
  'width',
  'height',
  'startupTimeoutMs',
  'startMaximized',
  'openDevTools',
])
let mainWindow

function boundedInteger(name, value, min, max) {
  if (!Number.isInteger(value)) {
    throw new Error(`desktop-shell: ${name} must be an integer`)
  }
  if (value < min || value > max) {
    throw new Error(`desktop-shell: ${name} must be between ${String(min)} and ${String(max)}`)
  }
  return value
}

function booleanOption(name, value) {
  if (typeof value !== 'boolean') throw new Error(`desktop-shell: ${name} must be a boolean`)
  return value
}

function localHarnessUrl(value) {
  if (typeof value !== 'string') throw new Error('desktop-shell: url must be a string')
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new Error('desktop-shell: url must use unauthenticated http://127.0.0.1')
  }
  return url
}

function parseDesktopOptions(args) {
  if (args.length !== 1 || !/^[A-Za-z0-9_-]+$/.test(args[0])) {
    throw new Error('desktop-shell: expected one encoded options payload')
  }
  let values
  try {
    values = JSON.parse(Buffer.from(args[0], 'base64url').toString('utf8'))
  } catch {
    throw new Error('desktop-shell: options payload is invalid')
  }
  if (values === null || typeof values !== 'object' || Array.isArray(values)
      || Object.keys(values).some(key => !optionNames.has(key))) {
    throw new Error('desktop-shell: options payload has an invalid shape')
  }
  return {
    url: localHarnessUrl(values.url),
    width: boundedInteger('width', values.width, 800, 7680),
    height: boundedInteger('height', values.height, 600, 4320),
    startupTimeoutMs: boundedInteger('startupTimeoutMs', values.startupTimeoutMs, 1000, 120000),
    startMaximized: booleanOption('startMaximized', values.startMaximized),
    openDevTools: booleanOption('openDevTools', values.openDevTools),
  }
}

function isHarnessOrigin(value, origin) {
  try {
    return new URL(value).origin === origin
  } catch {
    return false
  }
}

async function waitForHarness(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastFailure = 'not ready'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.ok) return
      lastFailure = `HTTP ${String(response.status)}`
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(100, deadline - Date.now())))
  }
  throw new Error(`desktop-shell: Harness did not become ready: ${lastFailure}`)
}

function configurePermissions(electronSession, origin) {
  electronSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => (
    allowedPermissions.has(permission) && isHarnessOrigin(requestingOrigin, origin)
  ))
  electronSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl ?? contents.getURL()
    callback(allowedPermissions.has(permission) && isHarnessOrigin(requestingUrl, origin))
  })
}

function applyWindowAction(target, action) {
  if (action === 'minimize') target.minimize()
  else if (action === 'toggle-maximize') {
    if (target.isMaximized()) target.unmaximize()
    else target.maximize()
  } else if (action === 'close') target.close()
  else return false
  return true
}

async function runDesktop(options) {
  const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require('electron')
  app.enableSandbox()
  await app.whenReady()
  Menu.setApplicationMenu(null)
  configurePermissions(session.defaultSession, options.url.origin)
  app.on('window-all-closed', () => app.quit())
  ipcMain.on('dsh-desktop-window-action', (event, action) => {
    if (event.sender === mainWindow?.webContents) applyWindowAction(mainWindow, action)
  })

  mainWindow = new BrowserWindow({
    width: options.width,
    height: options.height,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow.webContents.on('will-frame-navigate', (event, details) => {
    if (!isHarnessOrigin(details.url, options.url.origin)) event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  try {
    await waitForHarness(options.url, options.startupTimeoutMs)
    await mainWindow.loadURL(options.url.href)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    dialog.showErrorBox('DeepSeek Harness Desktop', message)
    app.exit(1)
    return
  }
  if (options.startMaximized) mainWindow.maximize()
  if (options.openDevTools) mainWindow.webContents.openDevTools({ mode: 'detach' })
  mainWindow.show()
  console.log(`dsh desktop: ${options.url.href}`)
}

module.exports = { applyWindowAction, isHarnessOrigin, parseDesktopOptions, waitForHarness }

if (process.versions.electron !== undefined) {
  void Promise.resolve().then(() => runDesktop(parseDesktopOptions(process.argv.slice(2)))).catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error))
    process.exit(1)
  })
}
