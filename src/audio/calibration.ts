import { median } from '../domain/stats'

export type BleedResult = { hits: number; total: number; bleed: boolean }

/**
 * Kopfhörer-Check: Klicks laufen, du bist still. Hört das Mikrofon mindestens `minHits`
 * Klicks (Einsatz bis `windowSeconds` nach dem Klick), kommt der Klick über die Lautsprecher.
 */
export function detectBleed(clickTimes: number[], onsetTimes: number[], windowSeconds = 0.15, minHits = 4): BleedResult {
  const hits = clickTimes.filter((t) => onsetTimes.some((o) => o >= t && o <= t + windowSeconds)).length
  return { hits, total: clickTimes.length, bleed: hits >= minHits }
}

export type LatencyResult =
  | { ok: true; latencySeconds: number; spreadSeconds: number; matched: number }
  | { ok: false; reason: 'zu-wenige' | 'zu-unruhig'; matched: number; spreadSeconds: number }

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * Latenz-Messung: Du sprichst "Ta" auf jeden Klick. Pro Klick zählt der erste Einsatz im Fenster
 * [-100 ms, +400 ms]. Ergebnis ist der Median der Abweichungen. Streuung = Interquartilsabstand.
 */
export function measureLatency(
  clickTimes: number[],
  onsetTimes: number[],
  opts: { searchFrom?: number; searchTo?: number; minMatched?: number; maxSpread?: number } = {},
): LatencyResult {
  const { searchFrom = -0.1, searchTo = 0.4, minMatched = 6, maxSpread = 0.04 } = opts
  const used = new Set<number>()
  const offsets: number[] = []
  for (const t of clickTimes) {
    const index = onsetTimes.findIndex((o, i) => !used.has(i) && o >= t + searchFrom && o <= t + searchTo)
    if (index >= 0) {
      used.add(index)
      offsets.push(onsetTimes[index] - t)
    }
  }
  const sorted = [...offsets].sort((a, b) => a - b)
  const spread = sorted.length >= 2 ? quantile(sorted, 0.75) - quantile(sorted, 0.25) : 0
  if (offsets.length < minMatched) return { ok: false, reason: 'zu-wenige', matched: offsets.length, spreadSeconds: spread }
  if (spread > maxSpread) return { ok: false, reason: 'zu-unruhig', matched: offsets.length, spreadSeconds: spread }
  return { ok: true, latencySeconds: median(offsets), spreadSeconds: spread, matched: offsets.length }
}

/** Über 120 ms ist vermutlich ein Bluetooth-Kopfhörer im Spiel (Spec 7.5). */
export function latencyWarning(latencySeconds: number): 'bluetooth' | null {
  return latencySeconds > 0.12 ? 'bluetooth' : null
}

/** Rechnet einen erkannten Einsatz auf die Raster-Zeit zurück. */
export function correctOnsetTime(onsetTime: number, latencySeconds: number): number {
  return onsetTime - latencySeconds
}
