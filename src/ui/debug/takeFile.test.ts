import { describe, expect, it } from 'vitest'
import { DEFAULT_DETECTOR_PARAMS } from '../../audio/onset/detector'
import { buildTakeFile, takeBaseName } from './takeFile'

describe('buildTakeFile', () => {
  it('rechnet Zeiten relativ zum Aufnahmebeginn und lässt Früheres weg', () => {
    const take = buildTakeFile({
      patternId: 'tkdm',
      bpm: 100,
      sampleRate: 48000,
      recordingStartTime: 10,
      latencySeconds: 0.04,
      detectorParams: DEFAULT_DETECTOR_PARAMS,
      expected: [
        { t: 9.5, syl: 'ta', accent: false },
        { t: 12.25, syl: 'ka', accent: false },
      ],
      onsets: [
        { time: 9.9, peakDb: -30 },
        { time: 12.3, peakDb: -18 },
      ],
    })
    expect(take.expected).toEqual([{ t: 2.25, syl: 'ka', accent: false }])
    expect(take.onsets).toEqual([{ t: 2.3, peakDb: -18 }])
    expect(take.version).toBe(1)
  })
})

describe('buildTakeFile: Echo-Unterdrückung', () => {
  const base = {
    patternId: 'tkdm',
    bpm: 100,
    sampleRate: 48000,
    recordingStartTime: 0,
    latencySeconds: 0.04,
    detectorParams: DEFAULT_DETECTOR_PARAMS,
    expected: [],
    onsets: [],
  }

  it('übernimmt den Wert in die Take-Datei, wenn er angegeben ist', () => {
    expect(buildTakeFile({ ...base, echoCancellation: true }).echoCancellation).toBe(true)
    expect(buildTakeFile({ ...base, echoCancellation: false }).echoCancellation).toBe(false)
  })

  it('lässt das Feld weg, wenn er nicht angegeben ist, und bleibt bei Version 1', () => {
    const take = buildTakeFile(base)
    expect('echoCancellation' in take).toBe(false)
    expect(take.version).toBe(1)
  })
})

describe('takeBaseName', () => {
  it('baut einen dateisicheren Namen', () => {
    expect(takeBaseName('tkdm', 100, new Date('2026-10-02T20:15:30.123Z'))).toBe('take-tkdm-100bpm-2026-10-02T20-15-30')
  })
})
