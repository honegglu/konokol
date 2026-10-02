import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scheduler } from './scheduler'
import type { TimelineEvent } from './timeline'

const clicks = (from: number, to: number): TimelineEvent[] => {
  const out: TimelineEvent[] = []
  for (let t = Math.ceil(from * 4) / 4; t < to; t += 0.25) out.push({ kind: 'click', time: t, accent: false })
  return out
}

describe('Scheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('plant jedes Ereignis genau einmal und rechtzeitig', () => {
    const clock = { currentTime: 0 }
    const played: TimelineEvent[] = []
    const scheduler = new Scheduler(clock, clicks, (e) => played.push(e))
    scheduler.start(0)
    for (let i = 0; i < 80; i++) {
      clock.currentTime += 0.025
      vi.advanceTimersByTime(25)
      for (const e of played) expect(e.time).toBeGreaterThanOrEqual(0)
      expect(played.at(-1)?.time ?? 0).toBeGreaterThan(clock.currentTime - 0.25)
    }
    const times = played.map((e) => e.time)
    expect(new Set(times).size).toBe(times.length)
    expect(times.slice(0, 4)).toEqual([0, 0.25, 0.5, 0.75])
    expect(times.at(-1)).toBeGreaterThanOrEqual(2)
  })

  it('plant nach stop nichts mehr', () => {
    const clock = { currentTime: 0 }
    const play = vi.fn()
    const scheduler = new Scheduler(clock, clicks, play)
    scheduler.start(0)
    scheduler.stop()
    const count = play.mock.calls.length
    clock.currentTime = 5
    vi.advanceTimersByTime(500)
    expect(play.mock.calls.length).toBe(count)
    expect(scheduler.running).toBe(false)
  })
})
