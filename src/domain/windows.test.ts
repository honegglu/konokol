import { describe, expect, it } from 'vitest'
import { median } from './stats'
import { classifyOffset, timingWindows } from './windows'

describe('timingWindows', () => {
  it('skaliert mit dem Rasterschritt und begrenzt nach Spec 5.1', () => {
    expect(timingWindows(0.125)).toEqual({ tight: expect.closeTo(0.025, 9), loose: expect.closeTo(0.05625, 9) })
    expect(timingWindows(1)).toEqual({ tight: 0.05, loose: 0.12 })
    expect(timingWindows(0.07)).toEqual({ tight: 0.025, loose: 0.05 })
  })
  it('wendet die Toleranzfaktoren an', () => {
    expect(timingWindows(1, 'locker').tight).toBeCloseTo(0.07)
    expect(timingWindows(1, 'streng').loose).toBeCloseTo(0.084)
  })
})

describe('classifyOffset', () => {
  const w = { tight: 0.025, loose: 0.05 }
  it('ordnet Abweichungen ein', () => {
    expect(classifyOffset(0.01, w)).toBe('hit')
    expect(classifyOffset(-0.03, w)).toBe('early')
    expect(classifyOffset(0.04, w)).toBe('late')
    expect(classifyOffset(0.07, w)).toBe('miss')
    expect(classifyOffset(null, w)).toBe('miss')
  })
})

describe('median', () => {
  it('rechnet gerade und ungerade Längen', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNaN()
  })
})
