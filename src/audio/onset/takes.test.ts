import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { median } from '../../domain/stats'
import type { TakeFile } from '../../ui/debug/takeFile'
import { decodeWav } from '../dsp/wav'
import { detectOnsets } from './detector'
import { matchStats, onsetsInTargetRange } from './testSignals'

/**
 * Prüft echte Aufnahmen aus der Debug-Ansicht (tests/fixtures/takes/*.json + .wav).
 * Ohne Fixtures wird nichts geprüft.
 */
const DIR = path.resolve(import.meta.dirname, '../../../tests/fixtures/takes')
const takes = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : []

describe.skipIf(takes.length === 0)('Echte Takes', () => {
  for (const file of takes) {
    it(file, () => {
      const take = JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as TakeFile
      const { samples, sampleRate } = decodeWav(new Uint8Array(readFileSync(path.join(DIR, file.replace(/\.json$/, '.wav')))))
      expect(sampleRate).toBe(take.sampleRate)

      const offline = detectOnsets(samples, sampleRate, take.detectorParams).map((o) => o.time)
      const targets = take.expected.map((e) => e.t + take.latencySeconds)
      const steps = take.expected.slice(1).map((e, i) => e.t - take.expected[i].t)
      const step = Math.min(...steps.filter((s) => s > 0.001))
      // Bewertet werden nur die vollständigen Durchgänge: Einzählen, angefangener Durchgang und Stopp-Klick zählen nicht als Fehl-Einsätze.
      const stats = matchStats(targets, onsetsInTargetRange(offline, targets, step), step)

      // Erkennung: fast alle Silben gefunden, kaum Fehl-Einsätze.
      expect(stats.matched / targets.length).toBeGreaterThanOrEqual(0.95)
      expect(stats.extras / targets.length).toBeLessThanOrEqual(0.03)
      // Plausibilität: Abweichung inkl. menschlichem Timing bleibt im Rahmen.
      expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.04)
      // Worklet und Offline-Analyse liefern dieselben Einsätze (gleicher Algorithmus).
      const live = take.onsets.map((o) => o.t)
      const liveVsOffline = matchStats(live, offline, 0.02)
      expect(liveVsOffline.matched / Math.max(1, live.length)).toBeGreaterThanOrEqual(0.98)
    })
  }
})
