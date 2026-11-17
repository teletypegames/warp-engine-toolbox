addEventListener('DOMContentLoaded', async () => {
  const handoff = JSON.parse(document.getElementById('warpengine-handoff').textContent)
  const data = await (await fetch(handoff.path)).arrayBuffer()
  window.postMessage({ type: 'warpengine.payload', name: handoff.name, data }, '*', [data])
})
