import { describe, expect, it } from 'vitest'
import { OnsetDetector, detectOnsets, minIoiForGrid } from './detector'
import { median } from '../../domain/stats'
import { addNoise, matchStats, placeSyllables, referencePoint, synthSyllable } from './testSignals'

const SR = 48000

function sequence(bpm: number, div: number, count: number, noiseDb: number, vowelDbs: number[] = [-8]) {
  const step = 60 / bpm / div
  const syllables = vowelDbs.map((db, i) => synthSyllable(SR, { vowelDb: db, seed: i + 1 }))
  const refs = syllables.map((s) => referencePoint(s, SR))
  const targets = Array.from({ length: count }, (_, k) => 0.4 + k * step)
  const signal = placeSyllables(SR, targets, syllables, refs, 0.4 + count * step + 0.6)
  addNoise(signal, noiseDb, 7)
  return { signal, targets, step }
}

describe('OnsetDetector', () => {
  it('setzt den Einsatz einer Silbe auf den Vokal, nicht auf den Konsonanten', () => {
    const syl = synthSyllable(SR)
    const ref = referencePoint(syl, SR)
    const vowelStart = 0.006 + 0.035
    expect(ref).toBeGreaterThan(vowelStart - 0.01)
    expect(ref).toBeLessThan(vowelStart + 0.015)
  })

  it('findet nichts in reinem Rauschen', () => {
    const noise = new Float32Array(SR * 2)
    addNoise(noise, -50, 3)
    expect(detectOnsets(noise, SR)).toEqual([])
  })

  it('erkennt 16tel bei 120 BPM genau', () => {
    const { signal, targets, step } = sequence(120, 4, 32, -60)
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const stats = matchStats(targets, onsets.map((o) => o.time), step)
    expect(stats.matched).toBe(32)
    expect(stats.extras).toBe(0)
    expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.003)
    expect(Math.max(...stats.errors.map(Math.abs))).toBeLessThan(0.01)
  })

  it('bleibt bei deutlichem Rauschen (-40 dBFS) zuverlässig', () => {
    const { signal, targets, step } = sequence(120, 4, 32, -40)
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const stats = matchStats(targets, onsets.map((o) => o.time), step)
    expect(stats.matched).toBeGreaterThanOrEqual(31)
    expect(stats.extras).toBeLessThanOrEqual(1)
    expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.005)
  })

  it('erkennt Septolen bei 80 BPM', () => {
    const { signal, targets, step } = sequence(80, 7, 28, -60)
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const stats = matchStats(targets, onsets.map((o) => o.time), step)
    expect(stats.matched).toBe(28)
    expect(stats.extras).toBe(0)
  })

  it('liefert Pegelunterschiede für Akzente', () => {
    const { signal, step } = sequence(100, 2, 16, -60, [-8, -14])
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    expect(onsets).toHaveLength(16)
    const diffs = onsets.slice(0, 14).filter((_, i) => i % 2 === 0).map((o, i) => o.peakDb - onsets[i * 2 + 1].peakDb)
    for (const d of diffs) expect(d).toBeGreaterThan(4.5)
  })

  it('liefert blockweise dieselben Einsätze wie am Stück', () => {
    const { signal, step } = sequence(100, 3, 12, -60)
    const whole = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const detector = new OnsetDetector(SR, { minIoiSeconds: minIoiForGrid(step) })
    const streamed = []
    for (let i = 0; i < signal.length; i += 128) {
      streamed.push(...detector.process(signal.subarray(i, i + 128), i).onsets)
    }
    streamed.push(...detector.flush())
    expect(streamed.map((o) => o.time)).toEqual(whole.map((o) => o.time))
  })

  it('rechnet Zeiten ab dem Start-Frame des ersten Blocks', () => {
    const { signal, step } = sequence(60, 1, 4, -60)
    const detector = new OnsetDetector(SR, { minIoiSeconds: minIoiForGrid(step) })
    const shifted = [...detector.process(signal, SR).onsets, ...detector.flush()]
    const plain = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    expect(shifted.map((o) => o.time - 1)).toEqual(plain.map((o) => expect.closeTo(o.time, 9)))
  })

  it('meldet Energie und Grundpegel pro Hop', () => {
    const detector = new OnsetDetector(SR)
    const { frames } = detector.process(new Float32Array(1280), 0)
    expect(frames).toHaveLength(10)
    expect(frames[1].time).toBeCloseTo(128 / SR)
  })
})
