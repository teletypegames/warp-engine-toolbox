(function () {
  const vscode = acquireVsCodeApi()
  document.addEventListener('click', (event) => {
    if (event.target instanceof HTMLDialogElement) { event.target.close(); return }
    const toggle = event.target instanceof Element ? event.target.closest('[data-dialog],[data-close]') : null
    if (toggle) {
      const id = toggle.getAttribute('data-dialog')
      if (id) document.getElementById(id)?.showModal()
      else toggle.closest('dialog')?.close()
      return
    }
    const target = event.target instanceof Element ? event.target.closest('[data-command],[data-open],[data-url]') : null
    if (!target) return
    event.preventDefault()
    const command = target.getAttribute('data-command')
    const open = target.getAttribute('data-open')
    if (command) vscode.postMessage({ type: 'command', command })
    else if (open) vscode.postMessage({ type: 'openProject', name: open })
    else vscode.postMessage({ type: 'open', url: target.getAttribute('data-url') })
  })
})()
