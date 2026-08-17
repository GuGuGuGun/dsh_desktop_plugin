const { ipcRenderer } = require('electron')

function createWindowButton(action, label, symbol) {
  const button = document.createElement('button')
  button.id = `dsh-desktop-${action}`
  button.className = 'dsh-desktop-window-button'
  button.type = 'button'
  button.textContent = symbol
  button.title = label
  button.setAttribute('aria-label', label)
  button.addEventListener('click', () => ipcRenderer.send('dsh-desktop-window-action', action))
  return button
}

if (process.isMainFrame) {
  window.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = `
      #dsh-desktop-drag-region {
        position: fixed;
        inset: 0 138px auto 0;
        height: 8px;
        z-index: 2147483646;
        app-region: drag;
        -webkit-app-region: drag;
      }
      #dsh-desktop-window-controls {
        position: fixed;
        top: 0;
        right: 0;
        height: 34px;
        z-index: 2147483647;
        display: flex;
        app-region: no-drag;
        -webkit-app-region: no-drag;
      }
      .dsh-desktop-window-button {
        width: 46px;
        height: 34px;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: #c8c8c8;
        font: 20px/34px "Segoe UI Symbol", sans-serif;
        cursor: default;
        app-region: no-drag;
        -webkit-app-region: no-drag;
      }
      .dsh-desktop-window-button:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      #dsh-desktop-close:hover {
        background: #c42b1c;
        color: #fff;
      }
      #dsh-desktop-close {
        font-size: 24px;
      }
      .dsh-desktop-window-button:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: -3px;
      }
    `

    const dragRegion = document.createElement('div')
    dragRegion.id = 'dsh-desktop-drag-region'
    dragRegion.setAttribute('aria-hidden', 'true')

    const controls = document.createElement('div')
    controls.id = 'dsh-desktop-window-controls'
    controls.append(
      createWindowButton('minimize', '最小化', '−'),
      createWindowButton('toggle-maximize', '最大化或还原', '□'),
      createWindowButton('close', '关闭窗口', '×'),
    )

    document.head.append(style)
    document.body.append(dragRegion, controls)
  }, { once: true })
}
