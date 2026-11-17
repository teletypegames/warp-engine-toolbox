addEventListener('message', (event) => { if (event.source !== window && event.data && event.data.type === 'warpengine.payload') window.postMessage(event.data, '*') })
addEventListener('DOMContentLoaded', () => warpengineApi.postMessage({ type: 'ready' }))
