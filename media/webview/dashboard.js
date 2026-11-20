(function () {
  const vscode = acquireVsCodeApi()
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-command],[data-url]') : null
    if (!target) return
    event.preventDefault()
    const command = target.getAttribute('data-command')
    if (command) vscode.postMessage({ type: 'command', command })
    else vscode.postMessage({ type: 'open', url: target.getAttribute('data-url') })
  })
})()
