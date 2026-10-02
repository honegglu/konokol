import { beatDuration, expectedEvents, patternDuration } from '../domain/pattern'
import type { Pattern, SyllableId } from '../domain/types'
import { COUNT_WORDS, type CountWord } from './manifest'

export type TimelineEvent =
  | { kind: 'click'; time: number; accent: boolean }
  | { kind: 'count'; time: number; word: CountWord }
  | { kind: 'syllable'; time: number; syl: SyllableId; accent: boolean; loop: number; index: number; gain: number }

export type TimelineOptions = {
  pattern: Pattern
  bpm: number
  /** Audio-Zeit, zu der der erste Schlag (Einzählen oder Durchgang 1) erklingt. */
  startTime: number
  countInBars: 0 | 1
  /** Anzahl Durchgänge, `null` = endlos. */
  loops: number | null
  click: boolean
  voice: boolean
  /** Stimmlautstärke pro Durchgang (0..1). Der letzte Wert gilt für alle weiteren. Standard: 1. */
  voiceGains?: number[]
}

export function firstLoopTime(opts: TimelineOptions): number {
  return opts.startTime + opts.countInBars * 4 * beatDuration(opts.bpm)
}

export function loopStartTime(opts: TimelineOptions, loop: number): number {
  return firstLoopTime(opts) + loop * patternDuration(opts.pattern, opts.bpm)
}

/** Ende des letzten Durchgangs, `null` bei endlos. */
export function timelineEnd(opts: TimelineOptions): number | null {
  return opts.loops === null ? null : loopStartTime(opts, opts.loops)
}

function voiceGain(opts: TimelineOptions, loop: number): number {
  const gains = opts.voiceGains
  if (!gains || gains.length === 0) return 1
  return gains[Math.min(loop, gains.length - 1)]
}

/** Alle Ereignisse mit `from <= time < to`, zeitlich sortiert. */
export function timelineEvents(opts: TimelineOptions, from: number, to: number): TimelineEvent[] {
  const bd = beatDuration(opts.bpm)
  const events: TimelineEvent[] = []
  const inRange = (t: number) => t >= from && t < to

  for (let b = 0; b < opts.countInBars * 4; b++) {
    const t = opts.startTime + b * bd
    if (!inRange(t)) continue
    if (opts.click) events.push({ kind: 'click', time: t, accent: b % 4 === 0 })
    events.push({ kind: 'count', time: t, word: COUNT_WORDS[b % 4] })
  }

  const loopDur = patternDuration(opts.pattern, opts.bpm)
  const first = firstLoopTime(opts)
  const lastLoop = opts.loops === null ? Number.POSITIVE_INFINITY : opts.loops - 1
  const fromLoop = Math.max(0, Math.floor((from - first) / loopDur))
  const toLoop = Math.min(lastLoop, Math.floor((to - first) / loopDur))
  for (let loop = fromLoop; loop <= toLoop; loop++) {
    const loopStart = first + loop * loopDur
    if (opts.click) {
      opts.pattern.beats.forEach((_, b) => {
        const t = loopStart + b * bd
        if (inRange(t)) events.push({ kind: 'click', time: t, accent: b % 4 === 0 })
      })
    }
    if (opts.voice) {
      const gain = voiceGain(opts, loop)
      expectedEvents(opts.pattern, opts.bpm, loopStart).forEach((e, index) => {
        if (inRange(e.t)) events.push({ kind: 'syllable', time: e.t, syl: e.syl, accent: e.accent, loop, index, gain })
      })
    }
  }
  return events.sort((a, b) => a.time - b.time)
}
