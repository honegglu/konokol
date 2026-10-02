import { describe, expect, it } from 'vitest'
import { matchNearest, summarize, type ExpectedMark } from './analysis'

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
    expect(summary.perSyllable.find((s) => s.syl === 'ka')?.medianSignedMs).toBeCloseTo(20)
  })
})
