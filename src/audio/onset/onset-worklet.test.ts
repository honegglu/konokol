import { beforeAll, describe, expect, it } from 'vitest'
import type { Onset } from './detector'
import type { WorkletOutMessage } from './messages'
import { matchStats, placeSyllables, referencePoint, synthSyllable } from './testSignals'

/**
 * Bildet den AudioWorkletGlobalScope nach und testet den Prozessor direkt.
 * Wichtig: Browser liefern für Quanten ohne aktive Quelle einen leeren Eingang.
 */
type Port = { postMessage: (message: WorkletOutMessage) => void; onmessage: ((event: { data: unknown }) => void) | null }
type Processor = { port: Port; process(inputs: Float32Array[][]): boolean }

const SR = 48000
const scope = globalThis as unknown as Record<string, unknown>
let ProcessorCtor: new () => Processor

beforeAll(async () => {
  scope.sampleRate = SR
  scope.currentFrame = 0
  scope.AudioWorkletProcessor = class {
    port: Port = { postMessage: () => {}, onmessage: null }
  }
  scope.registerProcessor = (_name: string, ctor: new () => Processor) => {
    ProcessorCtor = ctor
  }
  await import('./onset-worklet')
})

function run(processor: Processor, quanta: (Float32Array | null)[]): void {
  let frame = 0
  for (const quantum of quanta) {
    scope.currentFrame = frame
    processor.process([quantum ? [quantum] : []])
    frame += 128
  }
}

describe('onset-worklet', () => {
  it('rechnet lückenlos weiter, auch wenn Quanten ohne Eingang kommen', () => {
    const processor = new ProcessorCtor()
    const messages: WorkletOutMessage[] = []
    processor.port.postMessage = (m) => messages.push(m)

    const syllable = synthSyllable(SR)
    const ref = referencePoint(syllable, SR)
    const step = 0.25
    const targets = [0.3, 0.55, 0.8, 1.05]
    const signal = placeSyllables(SR, targets, [syllable], [ref], 1.536) // 576 Quanten
    // Ein Quantum mit Eingang setzt den Nullpunkt, danach 1 s ohne Eingang, dann die Silben.
    const silentQuanta = 375
    const quanta: (Float32Array | null)[] = [new Float32Array(128), ...Array.from({ length: silentQuanta - 1 }, () => null)]
    for (let i = 0; i < signal.length; i += 128) quanta.push(signal.subarray(i, i + 128))
    run(processor, quanta)
    processor.port.onmessage?.({ data: { type: 'flush' } })

    const onsets: Onset[] = messages.flatMap((m) => (m.type === 'onsets' ? m.onsets : []))
    const offset = (silentQuanta * 128) / SR
    const stats = matchStats(targets.map((t) => t + offset), onsets.map((o) => o.time), step)
    expect(stats.matched).toBe(4)
    expect(Math.max(...stats.errors.map(Math.abs))).toBeLessThan(0.005)
  })

  it('schickt Audio blockweise mit Start-Frame', () => {
    const processor = new ProcessorCtor()
    const messages: WorkletOutMessage[] = []
    processor.port.postMessage = (m) => messages.push(m)
    run(processor, Array.from({ length: 32 }, () => new Float32Array(128).fill(0.01)))
    const blocks = messages.filter((m) => m.type === 'block')
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.type === 'block' && b.startFrame)).toEqual([0, 2048])
  })
})
