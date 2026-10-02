import { describe, expect, it } from 'vitest'
import { peak, toDb } from '../../src/audio/dsp/level'
import { synthSyllable } from '../../src/audio/onset/testSignals'
import { firstAbove, lastAbove, prepareSyllable, prepareUiSound } from './analyze'

const SR = 24000

function withSilence(sound: Float32Array, leadSeconds: number, tailSeconds: number): Float32Array {
  const out = new Float32Array(Math.round((leadSeconds + tailSeconds) * SR) + sound.length)
  out.set(sound, Math.round(leadSeconds * SR))
  return out
}

describe('firstAbove / lastAbove', () => {
  it('findet Anfang und Ende eines Klangs', () => {
    const tone = new Float32Array(2400).fill(0.5)
    const signal = withSilence(tone, 0.1, 0.1)
    expect(firstAbove(signal, SR, -45) / SR).toBeCloseTo(0.1 - 0.004, 2)
    expect(lastAbove(signal, SR, -45) / SR).toBeCloseTo(0.2 + 0.004, 2)
    expect(firstAbove(new Float32Array(2400), SR, -45)).toBe(-1)
  })
})

describe('prepareSyllable', () => {
  const raw = withSilence(synthSyllable(SR), 0.11, 0.3)
  const prepared = prepareSyllable(raw, SR, { peakDb: -7 })

  it('schneidet die Stille vorne bis kurz vor den Konsonanten weg', () => {
    expect(firstAbove(prepared.samples, SR, -45) / SR).toBeLessThan(0.004)
  })

  it('setzt den Referenzpunkt auf den Vokal', () => {
    const vowelStart = 0.006 + 0.035
    expect(prepared.refSeconds).toBeGreaterThan(vowelStart - 0.01)
    expect(prepared.refSeconds).toBeLessThan(vowelStart + 0.02)
  })

  it('kürzt auf Einsatz + 130 ms, blendet aus und normalisiert', () => {
    expect(prepared.samples.length / SR).toBeCloseTo(prepared.refSeconds + 0.13, 2)
    expect(prepared.samples[prepared.samples.length - 1]).toBeCloseTo(0)
    expect(toDb(peak(prepared.samples))).toBeCloseTo(-7, 3)
    expect(prepared.onsetCount).toBe(1)
  })

  it('meldet zu leise Aufnahmen', () => {
    expect(() => prepareSyllable(new Float32Array(SR), SR, { peakDb: -7 })).toThrow('zu leise')
  })
})

describe('prepareUiSound', () => {
  it('schneidet Stille ab und begrenzt die Länge', () => {
    const tone = Float32Array.from({ length: SR * 3 }, (_, i) => Math.sin(i / 3) * 0.3)
    const out = prepareUiSound(withSilence(tone, 0.2, 0.5), SR, -3, 1.5)
    expect(out.length / SR).toBeCloseTo(1.5, 2)
    expect(toDb(peak(out))).toBeCloseTo(-3, 3)
  })
})
