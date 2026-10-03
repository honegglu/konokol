import type { DetectorParams } from '../../audio/onset/detector'
import type { SyllableId } from '../../domain/types'

/**
 * Format für exportierte Aufnahmen (Test-Fixtures). Alle Zeiten in Sekunden ab dem ersten
 * Sample der zugehörigen WAV-Datei. `onsets` sind die live erkannten, unkorrigierten Einsätze.
 */
export type TakeFile = {
  version: 1
  patternId: string
  bpm: number
  sampleRate: number
  latencySeconds: number
  detectorParams: DetectorParams
  expected: { t: number; syl: SyllableId; accent: boolean }[]
  onsets: { t: number; peakDb: number }[]
  /** War beim Mikrofon die Echo-Unterdrückung des Browsers an? Fehlt in älteren Takes (dort war sie immer aus). */
  echoCancellation?: boolean
}

export function buildTakeFile(input: {
  patternId: string
  bpm: number
  sampleRate: number
  recordingStartTime: number
  latencySeconds: number
  detectorParams: DetectorParams
  expected: { t: number; syl: SyllableId; accent: boolean }[]
  onsets: { time: number; peakDb: number }[]
  echoCancellation?: boolean
}): TakeFile {
  const rel = (t: number) => Number((t - input.recordingStartTime).toFixed(6))
  return {
    version: 1,
    patternId: input.patternId,
    bpm: input.bpm,
    sampleRate: input.sampleRate,
    latencySeconds: input.latencySeconds,
    detectorParams: input.detectorParams,
    expected: input.expected.filter((e) => e.t >= input.recordingStartTime).map((e) => ({ ...e, t: rel(e.t) })),
    onsets: input.onsets.filter((o) => o.time >= input.recordingStartTime).map((o) => ({ t: rel(o.time), peakDb: o.peakDb })),
    ...(input.echoCancellation === undefined ? {} : { echoCancellation: input.echoCancellation }),
  }
}

export function takeBaseName(patternId: string, bpm: number, date: Date): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `take-${patternId}-${bpm}bpm-${stamp}`
}

/** Startet im Browser den Download einer Datei. */
export function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
