import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORDS } from '../../content/syllables'
import { median } from '../../domain/stats'
import type { Division } from '../../domain/types'
import { decodeWav } from '../dsp/wav'
import type { SoundManifest } from '../manifest'
import { detectOnsets, minIoiForGrid } from './detector'
import { addNoise, matchStats, placeSyllables } from './testSignals'

/**
 * Baut Folgen aus den echten ElevenLabs-Samples (public/sounds) und prüft die Erkennung.
 * Läuft nur, wenn die Sounds generiert sind.
 */
const SOUNDS = path.resolve(import.meta.dirname, '../../../public/sounds')
const manifestPath = path.join(SOUNDS, 'manifest.json')
const hasSounds = existsSync(manifestPath)

function load(file: string): { samples: Float32Array; sampleRate: number } {
  return decodeWav(new Uint8Array(readFileSync(path.join(SOUNDS, file))))
}

describe.skipIf(!hasSounds)('Erkennung mit echten Silben-Samples', () => {
  const manifest = hasSounds ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as SoundManifest) : null

  const cases: { div: Division; bpm: number }[] = [
    { div: 2, bpm: 120 },
    { div: 3, bpm: 100 },
    { div: 4, bpm: 120 },
    { div: 5, bpm: 80 },
    { div: 7, bpm: 80 },
  ]

  for (const { div, bpm } of cases) {
    it(`${WORDS[div].join('-')} bei ${bpm} BPM: Median-Fehler < 10 ms, >= 95 % erkannt, <= 3 % zu viel`, () => {
      if (!manifest) return
      const words = WORDS[div]
      const loaded = words.map((syl) => load(manifest.syllables[syl].normal.file))
      const sampleRate = loaded[0].sampleRate
      const refs = words.map((syl) => manifest.syllables[syl].normal.refSeconds)
      const step = 60 / bpm / div
      const count = div * 8
      const targets = Array.from({ length: count }, (_, k) => 0.4 + k * step)
      const signal = placeSyllables(sampleRate, targets, loaded.map((l) => l.samples), refs, 0.4 + count * step + 0.6)
      addNoise(signal, -55, 11)
      const onsets = detectOnsets(signal, sampleRate, { minIoiSeconds: minIoiForGrid(step) })
      const stats = matchStats(targets, onsets.map((o) => o.time), step)
      expect(stats.matched / count).toBeGreaterThanOrEqual(0.95)
      expect(stats.extras / count).toBeLessThanOrEqual(0.03)
      expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.01)
    })
  }
})
