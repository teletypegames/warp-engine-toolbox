const warpengineApi = acquireVsCodeApi()
document.getElementById('warpengine-external').onclick = () => warpengineApi.postMessage({ type: 'external' })
document.getElementById('warpengine-replay').onclick = () => warpengineApi.postMessage({ type: 'replay' })
