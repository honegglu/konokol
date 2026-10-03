import { median } from '../../domain/stats'
import type { SyllableId } from '../../domain/types'
import { classifyOffset, timingWindows, type TimingClass } from '../../domain/windows'

/**
 * Einfache Zuordnung für die Debug-Ansicht: jede erwartete Silbe bekommt den nächstgelegenen
 * freien Einsatz innerhalb ±halber Rasterschritt. (Die echte Bewertung mit DP-Zuordnung folgt in Plan 2.)
 */

export type ExpectedMark = { t: number; syl: SyllableId; accent: boolean; loop: number }
export type OnsetMark = { t: number; peakDb: number }

export type MatchedMark = ExpectedMark & { offset: number | null; peakDb: number | null; cls: TimingClass }

export type DebugSummary = {
  expected: number
  matched: number
  extras: number
  /** `null`, wenn keine Silbe erkannt wurde. */
  medianAbsMs: number | null
  medianSignedMs: number | null
  /** Betonte und normale Silben getrennt, weil ihre Bezugspunkte verschieden sind. */
  perSyllable: { syl: SyllableId; accent: boolean; n: number; medianSignedMs: number }[]
}

export function matchNearest(expected: ExpectedMark[], onsets: OnsetMark[], step: number): { marks: MatchedMark[]; extras: OnsetMark[] } {
  const windows = timingWindows(step)
  const used = new Set<number>()
  const marks = expected.map((e): MatchedMark => {
    let best = -1
    for (let j = 0; j < onsets.length; j++) {
      if (used.has(j) || Math.abs(onsets[j].t - e.t) >= step / 2) continue
      if (best === -1 || Math.abs(onsets[j].t - e.t) < Math.abs(onsets[best].t - e.t)) best = j
    }
    if (best === -1) return { ...e, offset: null, peakDb: null, cls: 'miss' }
    used.add(best)
    const offset = onsets[best].t - e.t
    return { ...e, offset, peakDb: onsets[best].peakDb, cls: classifyOffset(offset, windows) }
  })
  return { marks, extras: onsets.filter((_, j) => !used.has(j)) }
}

export function summarize(marks: MatchedMark[], extras: number): DebugSummary {
  const offsets = marks.flatMap((m) => (m.offset === null ? [] : [m.offset]))
  const bySyl = new Map<string, { syl: SyllableId; accent: boolean; values: number[] }>()
  for (const m of marks) {
    if (m.offset === null) continue
    const key = `${m.syl}|${m.accent}`
    const entry = bySyl.get(key) ?? { syl: m.syl, accent: m.accent, values: [] }
    entry.values.push(m.offset)
    bySyl.set(key, entry)
  }
  return {
    expected: marks.length,
    matched: offsets.length,
    extras,
    medianAbsMs: offsets.length > 0 ? median(offsets.map(Math.abs)) * 1000 : null,
    medianSignedMs: offsets.length > 0 ? median(offsets) * 1000 : null,
    perSyllable: [...bySyl.values()].map(({ syl, accent, values }) => ({ syl, accent, n: values.length, medianSignedMs: median(values) * 1000 })),
  }
}
