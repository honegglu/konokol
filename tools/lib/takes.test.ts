import { describe, expect, it } from 'vitest'
import type { PreparedSyllable } from './analyze'
import { chooseTake } from './takes'

const take = (onsetCount: number): PreparedSyllable => ({ samples: new Float32Array(1), refSeconds: 0.05, onsetCount })

describe('chooseTake', () => {
  it('nimmt den ersten sauberen Take', () => {
    expect(chooseTake([take(2), take(1), take(1)]).index).toBe(1)
  })
  it('fällt auf Take 1 zurück', () => {
    const choice = chooseTake([take(2), take(3)])
    expect(choice.index).toBe(0)
    expect(choice.reason).toContain('kein Take')
  })
  it('respektiert eine manuelle Vorgabe', () => {
    expect(chooseTake([take(1), take(1), take(2)], 3).index).toBe(2)
    expect(() => chooseTake([take(1)], 2)).toThrow('Take 2 gibt es nicht')
  })
})
