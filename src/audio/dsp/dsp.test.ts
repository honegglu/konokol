import { describe, expect, it } from 'vitest'
import { fadeOut, fromDb, normalizePeak, peak, rms, toDb } from './level'
import { decodeWav, encodeWav16, pcm16ToFloat } from './wav'

describe('wav', () => {
  it('schreibt einen gültigen 16-Bit-Mono-Header', () => {
    const bytes = encodeWav16(new Float32Array(10), 24000)
    const view = new DataView(bytes.buffer)
    const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4))
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(24000)
    expect(view.getUint32(28, true)).toBe(48000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(20)
    expect(bytes.byteLength).toBe(64)
  })

  it('übersteht Hin- und Rückweg mit 16-Bit-Genauigkeit', () => {
    const input = Float32Array.from({ length: 500 }, (_, i) => Math.sin(i / 7) * 0.8)
    const { sampleRate, samples } = decodeWav(encodeWav16(input, 48000))
    expect(sampleRate).toBe(48000)
    expect(samples).toHaveLength(500)
    samples.forEach((s, i) => expect(Math.abs(s - input[i])).toBeLessThan(1 / 16000))
  })

  it('begrenzt Werte ausserhalb von -1..1', () => {
    const { samples } = decodeWav(encodeWav16(Float32Array.from([2, -2]), 8000))
    expect(samples[0]).toBeCloseTo(32767 / 32768, 4)
    expect(samples[1]).toBe(-1)
  })

  it('wandelt rohes PCM16 in Float', () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0]) // 16384, -16384
    expect(Array.from(pcm16ToFloat(bytes))).toEqual([0.5, -0.5])
  })

  it('lehnt Nicht-WAV ab', () => {
    expect(() => decodeWav(new Uint8Array(44))).toThrow('Keine WAV-Datei')
  })
})

describe('level', () => {
  it('rechnet zwischen Amplitude und dB', () => {
    expect(toDb(1)).toBeCloseTo(0)
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1)
    expect(fromDb(-6.0206)).toBeCloseTo(0.5, 3)
  })

  it('misst Spitze und RMS', () => {
    const s = Float32Array.from([0.5, -1, 0.5, 0])
    expect(peak(s)).toBe(1)
    expect(rms(s)).toBeCloseTo(Math.sqrt(1.5 / 4))
  })

  it('normalisiert auf den Ziel-Spitzenpegel', () => {
    const out = normalizePeak(Float32Array.from([0.1, -0.2]), -6)
    expect(toDb(peak(out))).toBeCloseTo(-6, 5)
  })

  it('blendet linear aus und endet bei 0', () => {
    const out = fadeOut(new Float32Array(100).fill(1), 1000, 10)
    expect(out[89]).toBe(1)
    expect(out[95]).toBeCloseTo(0.4)
    expect(out[99]).toBe(0)
  })
})
