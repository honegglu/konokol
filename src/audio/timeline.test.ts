import { describe, expect, it } from 'vitest'
import { wordBeat } from '../content/syllables'
import type { Pattern } from '../domain/types'
import { firstLoopTime, loopStartTime, timelineEnd, timelineEvents, type TimelineOptions } from './timeline'

const taka: Pattern = { id: 'taka', title: 'Ta-ka', beats: [1, 2, 3, 4].map(() => wordBeat(2, true)) }
const base: TimelineOptions = { pattern: taka, bpm: 60, startTime: 10, countInBars: 1, loops: 2, click: true, voice: true }

describe('timeline', () => {
  it('beginnt nach einem Einzähltakt', () => {
    expect(firstLoopTime(base)).toBe(14)
    expect(loopStartTime(base, 1)).toBe(18)
    expect(timelineEnd(base)).toBe(22)
    expect(timelineEnd({ ...base, loops: null })).toBeNull()
  })

  it('zählt mit Klick und Wörtern ein', () => {
    const events = timelineEvents(base, 10, 14)
    expect(events.filter((e) => e.kind === 'count').map((e) => e.kind === 'count' && e.word)).toEqual(['eins', 'zwei', 'drei', 'vier'])
    expect(events.filter((e) => e.kind === 'click').map((e) => e.kind === 'click' && e.accent)).toEqual([true, false, false, false])
    expect(events.some((e) => e.kind === 'syllable')).toBe(false)
  })

  it('liefert Silben und Klicks pro Durchgang', () => {
    const events = timelineEvents(base, 14, 22)
    const syllables = events.filter((e) => e.kind === 'syllable')
    expect(syllables).toHaveLength(16)
    expect(syllables[0]).toMatchObject({ time: 14, syl: 'ta', accent: true, loop: 0, index: 0 })
    expect(syllables[9]).toMatchObject({ time: 18.5, syl: 'ka', loop: 1, index: 1 })
    expect(events.filter((e) => e.kind === 'click')).toHaveLength(8)
  })

  it('liefert jedes Ereignis bei aneinandergereihten Fenstern genau einmal', () => {
    const all = timelineEvents(base, 0, 100)
    const pieces = [0, 3.3, 7.1, 14, 14.01, 17.999, 22, 100]
    const stitched = pieces.slice(1).flatMap((to, i) => timelineEvents(base, pieces[i], to))
    expect(stitched).toEqual(all)
    expect(all).toHaveLength(4 + 4 + 8 + 16)
  })

  it('läuft endlos weiter, wenn loops null ist', () => {
    const events = timelineEvents({ ...base, loops: null }, 1000, 1004)
    expect(events.filter((e) => e.kind === 'syllable')).toHaveLength(8)
  })

  it('setzt die Stimmlautstärke pro Durchgang', () => {
    const events = timelineEvents({ ...base, loops: 4, voiceGains: [1, 0.6, 0.25, 0] }, 14, 30)
    const gains = events.flatMap((e) => (e.kind === 'syllable' && e.index === 0 ? [e.gain] : []))
    expect(gains).toEqual([1, 0.6, 0.25, 0])
  })

  it('lässt Klick oder Stimme weg, wenn abgeschaltet', () => {
    expect(timelineEvents({ ...base, click: false }, 14, 18).every((e) => e.kind === 'syllable')).toBe(true)
    expect(timelineEvents({ ...base, voice: false }, 14, 18).every((e) => e.kind === 'click')).toBe(true)
  })
})
