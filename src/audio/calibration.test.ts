import { describe, expect, it } from 'vitest'
import { correctOnsetTime, detectBleed, latencyWarning, measureLatency } from './calibration'

const clicks = [0, 1, 2, 3, 4, 5, 6, 7]

describe('detectBleed', () => {
  it('erkennt Klicks, die über die Lautsprecher ins Mikrofon kommen', () => {
    const onsets = clicks.slice(0, 5).map((t) => t + 0.03)
    expect(detectBleed(clicks, onsets)).toEqual({ hits: 5, total: 8, bleed: true })
  })
  it('bleibt ruhig bei Kopfhörern', () => {
    expect(detectBleed(clicks, [2.5, 6.6])).toEqual({ hits: 0, total: 8, bleed: false })
  })
})

describe('measureLatency', () => {
  it('nimmt den Median der Abweichungen', () => {
    const offsets = [0.041, 0.038, 0.045, 0.04, 0.043, 0.039, 0.042, 0.2]
    const result = measureLatency(clicks, clicks.map((t, i) => t + offsets[i]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.latencySeconds).toBeCloseTo(0.0415, 4)
      expect(result.matched).toBe(8)
    }
  })

  it('verlangt mindestens 6 Treffer', () => {
    const result = measureLatency(clicks, [0.05, 1.05, 2.05])
    expect(result).toMatchObject({ ok: false, reason: 'zu-wenige', matched: 3 })
  })

  it('lehnt zu unruhige Messungen ab', () => {
    const offsets = [0, 0.1, 0.02, 0.15, 0.01, 0.12, 0.03, 0.14]
    expect(measureLatency(clicks, clicks.map((t, i) => t + offsets[i]))).toMatchObject({ ok: false, reason: 'zu-unruhig' })
  })

  it('verwendet jeden Einsatz nur einmal', () => {
    const result = measureLatency([0, 0.3], [0.05], { minMatched: 1 })
    expect(result).toMatchObject({ ok: true, matched: 1 })
  })
})

describe('Hilfen', () => {
  it('warnt ab 120 ms vor Bluetooth', () => {
    expect(latencyWarning(0.08)).toBeNull()
    expect(latencyWarning(0.19)).toBe('bluetooth')
  })
  it('zieht die Latenz ab', () => {
    expect(correctOnsetTime(5.06, 0.04)).toBeCloseTo(5.02)
  })
})
