import { expect, test } from '@playwright/test'

/** Lädt alle Sounds und spielt einen Takt Ta-ka-di-mi mit Einzählen ab. */
test('Engine lädt die Sounds und spielt Einzählen, Klicks und Silben', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // Pfade des Vite-Dev-Servers, zur Laufzeit im Browser aufgelöst.
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { loadSampleBank } = await load('/src/audio/sampleBank.ts')
    const { AudioEngine } = await load('/src/audio/engine.ts')
    const { wordBeat } = await load('/src/content/syllables.ts')
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    const bank = await loadSampleBank(ctx)
    const engine = new AudioEngine(ctx, bank)
    const counts: Record<string, number> = {}
    engine.onEvent = (e: { kind: string }) => {
      counts[e.kind] = (counts[e.kind] ?? 0) + 1
    }
    const pattern = { id: 'tkdm', title: 'Ta-ka-di-mi', beats: [1, 2, 3, 4].map(() => wordBeat(4, true)) }
    const playback = engine.start({ pattern, bpm: 120, countInBars: 1, loops: 1, click: true, voice: true })
    // Auf die Audio-Uhr warten statt auf eine feste Zeit: Beim Kaltstart braucht der Kontext länger.
    const deadline = performance.now() + 10_000
    while (ctx.currentTime < (playback.endTime ?? 0) + 0.3) {
      if (performance.now() > deadline) throw new Error('Audio-Uhr erreicht das Ende der Wiedergabe nicht (Timeout 10 s)')
      await new Promise((r) => setTimeout(r, 50))
    }
    engine.stop()
    await ctx.close()
    return {
      counts,
      firstLoop: playback.firstLoopTime - playback.startTime,
      end: (playback.endTime ?? 0) - playback.startTime,
      refTa: bank.syllable('ta', false).refSeconds,
    }
  })
  expect(result.counts).toEqual({ click: 8, count: 4, syllable: 16 })
  expect(result.firstLoop).toBeCloseTo(2)
  expect(result.end).toBeCloseTo(4)
  expect(result.refTa).toBeGreaterThan(0)
})

/** Nach `stop()` darf nichts mehr klingen, auch kein Klick, der schon vorausgeplant war. */
test('stop() verstummt sofort, auch bereits eingeplante Klicks', async ({ page }) => {
  await page.goto('/')
  const peak = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { loadSampleBank } = await load('/src/audio/sampleBank.ts')
    const { AudioEngine } = await load('/src/audio/engine.ts')
    const { wordBeat } = await load('/src/content/syllables.ts')
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    const bank = await loadSampleBank(ctx)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.connect(ctx.destination)
    const engine = new AudioEngine(ctx, bank, analyser)
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

    let lastClick = 0
    engine.onEvent = (e: { kind: string; time: number }) => {
      if (e.kind === 'click') lastClick = e.time
    }
    const pattern = { id: 'tkdm', title: 'Ta-ka-di-mi', beats: [1, 2, 3, 4].map(() => wordBeat(4, true)) }
    engine.start({ pattern, bpm: 120, countInBars: 1, loops: null, click: true, voice: false })
    await wait(1000)
    // Genau dann stoppen, wenn ein Klick schon eingeplant ist, aber noch nicht erklungen ist.
    while (lastClick < ctx.currentTime + 0.1) await wait(5)
    engine.stop()
    await wait(30)

    const data = new Float32Array(analyser.fftSize)
    let max = 0
    const until = performance.now() + 300
    while (performance.now() < until) {
      analyser.getFloatTimeDomainData(data)
      for (const v of data) max = Math.max(max, Math.abs(v))
      await wait(10)
    }
    await ctx.close()
    return max
  })
  expect(peak).toBeLessThan(0.001)
})
