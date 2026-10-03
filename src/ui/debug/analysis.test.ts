import { describe, expect, it } from 'vitest'
import { matchNearest, summarize, type ExpectedMark, type MatchedMark } from './analysis'

const expected: ExpectedMark[] = [0, 0.25, 0.5, 0.75].map((t, i) => ({ t, syl: i % 2 ? 'ka' : 'ta', accent: i === 0, loop: 0 }))

describe('matchNearest', () => {
  it('ordnet nächstgelegene Einsätze zu und klassifiziert', () => {
    const onsets = [0.01, 0.33, 0.6, 0.62].map((t) => ({ t, peakDb: -20 }))
    const { marks, extras } = matchNearest(expected, onsets, 0.25)
    expect(marks.map((m) => m.cls)).toEqual(['hit', 'late', 'late', 'miss'])
    expect(marks[1].offset).toBeCloseTo(0.08)
    expect(marks[2].offset).toBeCloseTo(0.1)
    expect(marks[3].offset).toBeNull()
    expect(extras.map((o) => o.t)).toEqual([0.62])
  })
})

describe('summarize', () => {
  it('fasst Treffer, Mediane und Silben zusammen', () => {
    const onsets = [0.01, 0.27, 0.51, 0.77].map((t) => ({ t, peakDb: -20 }))
    const { marks, extras } = matchNearest(expected, onsets, 0.25)
    const summary = summarize(marks, extras.length)
    expect(summary).toMatchObject({ expected: 4, matched: 4, extras: 0 })
    expect(summary.medianSignedMs).toBeCloseTo(15)
    expect(summary.perSyllable.find((s) => s.syl === 'ka' && !s.accent)).toMatchObject({ n: 2 })
    expect(summary.perSyllable.find((s) => s.syl === 'ka' && !s.accent)?.medianSignedMs).toBeCloseTo(20)
  })

  it('trennt betonte und normale Silben, weil sie verschiedene Bezugspunkte haben', () => {
    const marks = [
      { t: 0, syl: 'ta', accent: true, loop: 0, offset: 0.03, peakDb: -10, cls: 'late' },
      { t: 0.25, syl: 'ta', accent: false, loop: 0, offset: 0.01, peakDb: -20, cls: 'hit' },
      { t: 0.5, syl: 'ta', accent: false, loop: 0, offset: 0.015, peakDb: -20, cls: 'hit' },
      { t: 0.75, syl: 'ta', accent: true, loop: 0, offset: 0.035, peakDb: -10, cls: 'late' },
    ] satisfies MatchedMark[]
    const { perSyllable } = summarize(marks, 0)
    expect(perSyllable).toHaveLength(2)
    const accented = perSyllable.find((s) => s.syl === 'ta' && s.accent)
    const plain = perSyllable.find((s) => s.syl === 'ta' && !s.accent)
    expect(accented?.n).toBe(2)
    expect(accented?.medianSignedMs).toBeCloseTo(32.5)
    expect(plain?.n).toBe(2)
    expect(plain?.medianSignedMs).toBeCloseTo(12.5)
  })

  it('meldet keine Mediane, wenn keine Silbe erkannt wurde (statt NaN)', () => {
    const { marks, extras } = matchNearest(expected, [], 0.25)
    const summary = summarize(marks, extras.length)
    expect(summary).toMatchObject({ expected: 4, matched: 0, extras: 0, medianAbsMs: null, medianSignedMs: null, perSyllable: [] })
  })
})
