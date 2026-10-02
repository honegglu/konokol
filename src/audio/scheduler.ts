import type { TimelineEvent } from './timeline'

export type Clock = { readonly currentTime: number }

/**
 * Lookahead-Scheduler: Alle `intervalMs` werden die Ereignisse bis `currentTime + lookahead`
 * geholt und sample-genau eingeplant. JavaScript-Timer bestimmen nur, wann geplant wird,
 * nie, wann es klingt.
 */
export class Scheduler {
  private readonly clock: Clock
  private readonly source: (from: number, to: number) => TimelineEvent[]
  private readonly play: (event: TimelineEvent) => void
  private readonly lookahead: number
  private readonly intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private scheduledUntil = 0

  constructor(
    clock: Clock,
    source: (from: number, to: number) => TimelineEvent[],
    play: (event: TimelineEvent) => void,
    opts: { lookaheadSeconds?: number; intervalMs?: number } = {},
  ) {
    this.clock = clock
    this.source = source
    this.play = play
    this.lookahead = opts.lookaheadSeconds ?? 0.1
    this.intervalMs = opts.intervalMs ?? 25
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(fromTime: number): void {
    this.stop()
    this.scheduledUntil = fromTime
    this.tick()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  tick(): void {
    const to = this.clock.currentTime + this.lookahead
    if (to <= this.scheduledUntil) return
    for (const event of this.source(this.scheduledUntil, to)) this.play(event)
    this.scheduledUntil = to
  }
}
