import { describe, expect, it } from 'vitest'
import { WORDS, groupedBeats, syllableLabel, wordBeat } from '../content/syllables'
import { cellCount, expectedEvents, gridStep, patternDuration, validatePattern } from './pattern'
import type { Beat, Pattern } from './types'

const four = (beat: Beat): Beat[] => [beat, beat, beat, beat]

describe('syllables', () => {
  it('hat für jede Unterteilung ein Wort passender Länge', () => {
    for (const div of [1, 2, 3, 4, 5, 6, 7] as const) expect(WORDS[div]).toHaveLength(div)
  })
  it('betont auf Wunsch die erste Silbe', () => {
    const beat = wordBeat(3, true)
    expect(beat.cells.map((c) => c.accent)).toEqual([true, false, false])
  })
  it('verteilt Gruppen-Wörter auf Schläge', () => {
    const beats = groupedBeats([3, 3, 2], 4)
    expect(beats).toHaveLength(2)
    expect(beats[0].cells.map((c) => c.syl)).toEqual(['ta', 'ki', 'ta', 'ta'])
    expect(beats[1].cells.map((c) => c.syl)).toEqual(['ki', 'ta', 'ta', 'ka'])
    expect(beats.flatMap((b) => b.cells).map((c) => c.accent)).toEqual([true, false, false, true, false, false, true, false])
    expect(() => groupedBeats([3, 3], 4)).toThrow('6 Zellen passen nicht')
  })
  it('schreibt Gruppenanfänge gross', () => {
    expect(syllableLabel('ta', true)).toBe('Ta')
    expect(syllableLabel('thom', false)).toBe('thom')
  })
})

describe('expectedEvents', () => {
  it('verteilt Triolen gleichmässig auf den Schlag', () => {
    const pattern: Pattern = { id: 'tki', title: 'Ta-ki-ta', beats: four(wordBeat(3, true)) }
    const events = expectedEvents(pattern, 60)
    expect(events).toHaveLength(12)
    expect(events[0].t).toBeCloseTo(0)
    expect(events[1].t).toBeCloseTo(1 / 3)
    expect(events[2].t).toBeCloseTo(2 / 3)
    expect(events[3].t).toBeCloseTo(1)
    expect(events.filter((e) => e.accent)).toHaveLength(4)
  })

  it('kann Unterteilungen pro Schlag mischen', () => {
    const pattern: Pattern = { id: 'mix', title: 'Mix', beats: [wordBeat(2), wordBeat(3), wordBeat(1), wordBeat(4)] }
    const times = expectedEvents(pattern, 120).map((e) => e.t)
    expect(times).toEqual([0, 0.25, 0.5, 0.5 + 0.5 / 3, 0.5 + 1 / 3, 1, 1.5, 1.625, 1.75, 1.875].map((t) => expect.closeTo(t, 9)))
  })

  it('überspringt Pausen, behält aber die Position', () => {
    const gap: Beat = { div: 4, cells: [{ syl: 'ta' }, { syl: null }, { syl: 'di' }, { syl: 'mi' }] }
    const pattern: Pattern = { id: 'gap', title: 'Lücke', beats: four(gap) }
    const events = expectedEvents(pattern, 60)
    expect(events).toHaveLength(12)
    expect(events.slice(0, 3).map((e) => e.t)).toEqual([0, 0.5, 0.75])
    expect(events[1].cellIndex).toBe(2)
  })

  it('ordnet Silben den Gruppen 3+3+2 zu', () => {
    const pattern: Pattern = {
      id: '332',
      title: '3+3+2',
      beats: four(wordBeat(4)),
      groups: [3, 3, 2, 3, 3, 2],
    }
    const events = expectedEvents(pattern, 60)
    expect(events.map((e) => e.groupIndex)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5])
    expect(events.map((e) => e.posInGroup)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 0, 1, 2, 0, 1, 2, 0, 1])
  })

  it('nimmt ohne Gruppen jeden Schlag als Gruppe', () => {
    const pattern: Pattern = { id: 'tkdm', title: 'Ta-ka-di-mi', beats: four(wordBeat(4)) }
    const events = expectedEvents(pattern, 60)
    expect(events[5].groupIndex).toBe(1)
    expect(events[5].posInGroup).toBe(1)
  })

  it('verschiebt alle Zeiten um den Offset', () => {
    const pattern: Pattern = { id: 'ta', title: 'Ta', beats: four(wordBeat(1)) }
    expect(expectedEvents(pattern, 60, 2.5).map((e) => e.t)).toEqual([2.5, 3.5, 4.5, 5.5])
  })

  it('wirft bei ungültigem Pattern', () => {
    const bad: Pattern = { id: 'bad', title: 'Kaputt', beats: four({ div: 4, cells: [{ syl: 'ta' }] }) }
    expect(() => expectedEvents(bad, 60)).toThrow(/Schlag 1 hat 1 Zellen statt 4/)
  })
})

describe('validatePattern', () => {
  it('meldet falsche Taktlänge und Gruppensumme', () => {
    const pattern: Pattern = { id: 'x', title: 'X', beats: [wordBeat(4), wordBeat(4), wordBeat(4)], groups: [3, 3] }
    const errors = validatePattern(pattern)
    expect(errors).toContain('x: Anzahl Schläge (3) ist kein Vielfaches von 4')
    expect(errors).toContain('x: Gruppen ergeben 6 Zellen statt 12')
  })
})

describe('Hilfsfunktionen', () => {
  it('berechnet Rasterschritt, Dauer und Zellenzahl', () => {
    const pattern: Pattern = { id: 's', title: 'Septolen', beats: four(wordBeat(7)) }
    expect(gridStep(pattern, 80)).toBeCloseTo(0.75 / 7)
    expect(patternDuration(pattern, 80)).toBeCloseTo(3)
    expect(cellCount(pattern)).toBe(28)
  })
})
