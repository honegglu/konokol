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
    await new Promise((r) => setTimeout(r, 4600))
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
