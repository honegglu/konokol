import { expect, test } from '@playwright/test'

/**
 * Integrationstest im echten Browser: Die echten Silben-Samples laufen (ohne Mikrofon) direkt
 * in das Onset-Worklet. Zwischen zwei Hälften liegt eine Pause ohne aktive Quelle. Geprüft
 * werden Bündelung, Nachrichten und die lückenlose Zeitbasis auf der Audio-Uhr.
 */
test('Worklet erkennt Silben zeitgenau, auch nach einer Pause ohne Eingang', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // Pfade des Vite-Dev-Servers, zur Laufzeit im Browser aufgelöst.
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { loadSampleBank } = await load('/src/audio/sampleBank.ts')
    const { default: workletUrl } = await load('/src/audio/onset/onset-worklet.ts?worker&url')
    const { WORKLET_NAME } = await load('/src/audio/onset/messages.ts')
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    const bank = await loadSampleBank(ctx)
    await ctx.audioWorklet.addModule(workletUrl)
    const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
    })
    const sink = ctx.createGain()
    sink.gain.value = 0
    node.connect(sink).connect(ctx.destination)
    const onsets: number[] = []
    let lastMessageAt = performance.now()
    node.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'onsets') {
        onsets.push(...e.data.onsets.map((o: { time: number }) => o.time))
        lastMessageAt = performance.now()
      }
    }
    node.port.postMessage({ type: 'params', params: { minIoiSeconds: 0.075 } })
    const words = ['ta', 'ka', 'di', 'mi']
    const step = 0.125
    const targets: number[] = []
    const t0 = ctx.currentTime + 0.3
    for (const half of [0, 1]) {
      const start = t0 + half * (8 * step + 1.0) // 1 s Pause ohne Quelle
      for (let k = 0; k < 8; k++) {
        const sample = bank.syllable(words[k % 4], false)
        const src = ctx.createBufferSource()
        src.buffer = sample.buffer
        src.connect(node)
        targets.push(start + k * step)
        src.start(start + k * step - sample.refSeconds)
        if (k < 7) src.stop(start + (k + 1) * step - bank.syllable(words[(k + 1) % 4], false).refSeconds)
      }
    }
    // Auf die Audio-Uhr warten statt auf eine feste Zeit: Beim Kaltstart braucht der Kontext länger.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const deadline = performance.now() + 10_000
    while (ctx.currentTime < targets[targets.length - 1] + 0.5) {
      if (performance.now() > deadline) throw new Error('Audio-Uhr erreicht das Ende der Wiedergabe nicht (Timeout 10 s)')
      await sleep(50)
    }
    // Flush senden und warten, bis 100 ms lang kein weiterer Einsatz mehr eintrifft.
    node.port.postMessage({ type: 'flush' })
    lastMessageAt = performance.now()
    while (performance.now() - lastMessageAt < 100) {
      if (performance.now() > deadline) throw new Error('Worklet liefert nach dem Flush weiter Einsätze (Timeout 10 s)')
      await sleep(20)
    }
    await ctx.close()
    const errors = targets.map((t) => Math.min(...onsets.map((o) => Math.abs(o - t))))
    return { count: onsets.length, errors }
  })
  expect(result.count).toBe(16)
  const sorted = [...result.errors].sort((a, b) => a - b)
  expect(sorted[8]).toBeLessThan(0.003)
  expect(sorted[15]).toBeLessThan(0.01)
})
