addEventListener('pointerdown', () => document.getElementById('warpengine-start')?.remove(), { once: true, capture: true })
if (typeof navigator.getAutoplayPolicy === 'function' && navigator.getAutoplayPolicy('audiocontext') === 'allowed') document.getElementById('warpengine-start')?.remove()
