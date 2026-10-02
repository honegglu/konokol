import { fadeOut, normalizePeak, toDb } from '../../src/audio/dsp/level'
import { detectOnsets } from '../../src/audio/onset/detector'

/** Index des ersten Samples, ab dem das 5-ms-RMS (1-ms-Schritte) über `thresholdDb` liegt, sonst -1. */
export function firstAbove(samples: Float32Array, sampleRate: number, thresholdDb: number): number {
  const win = Math.max(1, Math.round(sampleRate * 0.005))
  const step = Math.max(1, Math.round(sampleRate * 0.001))
  for (let i = 0; i + win <= samples.length; i += step) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j]
    if (toDb(Math.sqrt(sum / win)) > thresholdDb) return i
  }
  return -1
}

/** Index nach dem letzten 5-ms-Fenster über `thresholdDb`, sonst -1. */
export function lastAbove(samples: Float32Array, sampleRate: number, thresholdDb: number): number {
  const win = Math.max(1, Math.round(sampleRate * 0.005))
  const step = Math.max(1, Math.round(sampleRate * 0.001))
  for (let i = samples.length - win; i >= 0; i -= step) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j]
    if (toDb(Math.sqrt(sum / win)) > thresholdDb) return i + win
  }
  return -1
}

/** Einsätze, die der Detektor in einem isolierten Klang findet (mit Stille davor und danach). */
export function isolatedOnsets(samples: Float32Array, sampleRate: number): number[] {
  const lead = Math.round(0.2 * sampleRate)
  const padded = new Float32Array(lead + samples.length + Math.round(0.3 * sampleRate))
  padded.set(samples, lead)
  // Sehr leises Dither, damit die Stille nicht digital null ist.
  for (let i = 0; i < padded.length; i++) padded[i] += (((i * 7919) % 2000) / 1000 - 1) * 1e-4
  return detectOnsets(padded, sampleRate).map((o) => o.time - lead / sampleRate)
}

export type PreparedSyllable = {
  samples: Float32Array
  /** Wahrgenommener Einsatz ab Dateibeginn (Sekunden). */
  refSeconds: number
  /** Anzahl erkannter Einsätze im fertigen Sample. 1 = sauber. */
  onsetCount: number
}

export type SyllableOptions = { peakDb: number; tailSeconds?: number; fadeMs?: number; preRollMs?: number }

/**
 * Bereitet eine gesprochene Silbe auf: Stille vorne weg (Schwelle -45 dBFS, 2 ms Vorlauf),
 * Ende bei Einsatz + `tailSeconds` (Standard 130 ms) mit Ausblenden, Spitzenpegel `peakDb`.
 */
export function prepareSyllable(raw: Float32Array, sampleRate: number, opts: SyllableOptions): PreparedSyllable {
  const { peakDb, tailSeconds = 0.13, fadeMs = 30, preRollMs = 2 } = opts
  const first = firstAbove(raw, sampleRate, -45)
  if (first < 0) throw new Error('Silbe ist zu leise (nichts über -45 dBFS)')
  const start = Math.max(0, first - Math.round((sampleRate * preRollMs) / 1000))
  const trimmed = raw.subarray(start)
  const onsets = isolatedOnsets(trimmed, sampleRate)
  if (onsets.length === 0) throw new Error('Kein Einsatz in der Silbe gefunden')
  const ref = onsets[0]
  const end = Math.min(trimmed.length, Math.round((ref + tailSeconds) * sampleRate))
  const shaped = normalizePeak(fadeOut(trimmed.slice(0, end), sampleRate, fadeMs), peakDb)
  return { samples: shaped, refSeconds: ref, onsetCount: isolatedOnsets(shaped, sampleRate).length }
}

/** Bereitet einen UI-Sound auf: Stille vorne und hinten weg (-50 dBFS), max. Länge, Ausblenden, Pegel. */
export function prepareUiSound(raw: Float32Array, sampleRate: number, peakDb: number, maxSeconds: number): Float32Array {
  const first = firstAbove(raw, sampleRate, -50)
  const last = lastAbove(raw, sampleRate, -50)
  if (first < 0 || last <= first) throw new Error('UI-Sound ist zu leise')
  const end = Math.min(last + Math.round(0.02 * sampleRate), first + Math.round(maxSeconds * sampleRate), raw.length)
  return normalizePeak(fadeOut(raw.slice(first, end), sampleRate, 50), peakDb)
}
