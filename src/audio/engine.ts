import type { UiSound } from './manifest'
import type { Sample, SampleBank } from './sampleBank'
import { Scheduler } from './scheduler'
import { firstLoopTime, timelineEnd, timelineEvents, type TimelineEvent, type TimelineOptions } from './timeline'

export type PlaybackOptions = Omit<TimelineOptions, 'startTime'>

export type Playback = {
  /** Audio-Zeit des ersten Schlags (Einzählen bzw. Durchgang 1). */
  startTime: number
  /** Audio-Zeit von Durchgang 1. */
  firstLoopTime: number
  /** Ende des letzten Durchgangs oder `null` bei endlos. */
  endTime: number | null
  options: TimelineOptions
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; level: number }

/** Eigener Ausgang einer Wiedergabe: `stop()` blendet ihn aus und trennt damit alles Eingeplante ab. */
type PlaybackBus = { master: GainNode; voice: GainNode; click: GainNode }

/** Spielt Klick, Einzählen und Silben sample-genau ab. */
export class AudioEngine {
  readonly ctx: AudioContext
  private readonly bank: SampleBank
  private readonly output: AudioNode
  private bus: PlaybackBus | null = null
  private scheduler: Scheduler | null = null
  private lastVoice: Voice | null = null
  private current: Playback | null = null
  /** Wird für jedes eingeplante Ereignis aufgerufen (z. B. für Anzeigen). */
  onEvent: ((event: TimelineEvent) => void) | null = null

  constructor(ctx: AudioContext, bank: SampleBank, output: AudioNode = ctx.destination) {
    this.ctx = ctx
    this.bank = bank
    this.output = output
  }

  get playback(): Playback | null {
    return this.current
  }

  /** Zeit, die gerade aus den Lautsprechern kommt (für Cursor und Anzeigen). */
  audibleTime(): number {
    return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0)
  }

  start(options: PlaybackOptions, leadSeconds = 0.2): Playback {
    this.stop()
    const bus = this.createBus()
    this.bus = bus
    const timeline: TimelineOptions = { ...options, startTime: this.ctx.currentTime + leadSeconds }
    this.current = {
      startTime: timeline.startTime,
      firstLoopTime: firstLoopTime(timeline),
      endTime: timelineEnd(timeline),
      options: timeline,
    }
    // Silben starten um ihren Einsatzpunkt früher, deshalb etwas weiter vorausplanen.
    this.scheduler = new Scheduler(this.ctx, (from, to) => timelineEvents(timeline, from, to), (e) => this.play(e, bus), {
      lookaheadSeconds: 0.25,
    })
    this.scheduler.start(this.ctx.currentTime)
    return this.current
  }

  stop(): void {
    this.scheduler?.stop()
    this.scheduler = null
    this.current = null
    this.lastVoice = null
    const bus = this.bus
    this.bus = null
    if (!bus) return
    // Alles, was diese Wiedergabe schon eingeplant hat (Klicks, Einzählen, Silben), hängt an ihrem Bus.
    const now = this.ctx.currentTime
    bus.master.gain.cancelScheduledValues(now)
    bus.master.gain.setValueAtTime(bus.master.gain.value, now)
    bus.master.gain.linearRampToValueAtTime(0, now + 0.01)
    setTimeout(() => bus.master.disconnect(), 50)
  }

  playUi(name: UiSound): void {
    const source = this.ctx.createBufferSource()
    source.buffer = this.bank.ui(name)
    source.connect(this.output)
    source.start()
  }

  private createBus(): PlaybackBus {
    const master = this.ctx.createGain()
    const voice = this.ctx.createGain()
    const click = this.ctx.createGain()
    click.gain.value = 0.7
    voice.connect(master)
    click.connect(master)
    master.connect(this.output)
    return { master, voice, click }
  }

  private play(event: TimelineEvent, bus: PlaybackBus): void {
    if (event.kind === 'click') this.click(event.time, event.accent, bus)
    else if (event.kind === 'count') this.voice(this.bank.count(event.word), event.time, 0.8, false, bus)
    else if (event.gain > 0) this.voice(this.bank.syllable(event.syl, event.accent), event.time, event.gain, true, bus)
    this.onEvent?.(event)
  }

  private click(time: number, accent: boolean, bus: PlaybackBus): void {
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = accent ? 1600 : 1000
    const peak = accent ? 1 : 0.6
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(peak, time + 0.001)
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.03)
    osc.connect(env).connect(bus.click)
    osc.start(time)
    osc.stop(time + 0.04)
  }

  /** Startet ein Sample so, dass sein Einsatzpunkt auf `beatTime` liegt. Optional schneidet es die vorherige Silbe ab. */
  private voice(sample: Sample, beatTime: number, level: number, choke: boolean, bus: PlaybackBus): void {
    const when = Math.max(beatTime - sample.refSeconds, this.ctx.currentTime)
    if (choke && this.lastVoice) {
      const prev = this.lastVoice
      prev.gain.gain.setValueAtTime(prev.level, Math.max(when - 0.005, this.ctx.currentTime))
      prev.gain.gain.linearRampToValueAtTime(0, when)
      prev.source.stop(when + 0.01)
    }
    const source = this.ctx.createBufferSource()
    source.buffer = sample.buffer
    const gain = this.ctx.createGain()
    gain.gain.value = level
    source.connect(gain).connect(bus.voice)
    source.start(when)
    if (choke) this.lastVoice = { source, gain, level }
  }
}
