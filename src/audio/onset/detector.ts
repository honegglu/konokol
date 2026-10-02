/**
 * Erkennt Silben-Einsätze in einem Audiostrom.
 *
 * Idee: Gemessen wird die geglättete Energie (Hochpass 150 Hz, ca. 10 ms Fenster).
 * Eine Silbe ist ein Anstieg vom Tal zum Gipfel. Als Einsatz gilt die Stelle, an der
 * der Anstieg `belowPeakDb` unter dem Gipfel liegt. Das ist praktisch der Vokalbeginn
 * und damit nahe am wahrgenommenen Schlag (P-Center). Ein schwacher Konsonanten-Knall
 * direkt vor einem deutlich lauteren Vokal wird auf den Vokal umgehängt.
 *
 * Der Detektor ist rein (keine Browser-APIs) und läuft im AudioWorklet sowie offline in Tests.
 */

export type DetectorParams = {
  /** Nur bei der Konstruktion wirksam. */
  hopSeconds: number
  /** Nur bei der Konstruktion wirksam. */
  highpassHz: number
  /** Nur bei der Konstruktion wirksam. */
  smoothSeconds: number
  riseDb: number
  peakDropDb: number
  peakHoldSeconds: number
  belowPeakDb: number
  aboveFloorDb: number
  minLevelDb: number
  floorRiseDbPerSecond: number
  mergeSeconds: number
  mergeDb: number
  minIoiSeconds: number
}

export const DEFAULT_DETECTOR_PARAMS: DetectorParams = {
  hopSeconds: 128 / 48000,
  highpassHz: 150,
  smoothSeconds: 0.0107,
  riseDb: 6,
  peakDropDb: 3,
  peakHoldSeconds: 0.03,
  belowPeakDb: 6,
  aboveFloorDb: 12,
  minLevelDb: -60,
  floorRiseDbPerSecond: 6,
  mergeSeconds: 0.08,
  mergeDb: 6,
  minIoiSeconds: 0.06,
}

/** Mindestabstand zwischen zwei Einsätzen für einen Rasterschritt (Spec 7.4, angepasst nach Prototyp). */
export function minIoiForGrid(stepSeconds: number): number {
  return Math.max(0.04, 0.6 * stepSeconds)
}

export type Onset = {
  /** Sekunden auf der Zeitachse des Eingangs (Frame / sampleRate). */
  time: number
  frame: number
  /** Gipfel der geglätteten Energie in dB, für Akzent-Vergleiche. */
  peakDb: number
}

export type FrameStat = { time: number; energyDb: number; floorDb: number }

export class OnsetDetector {
  private readonly sampleRate: number
  private params: DetectorParams
  private readonly hop: number
  private readonly smoothHops: number
  private readonly hpA: number
  private holdHops = 1
  private prevX = 0
  private prevY = 0
  private hopSum = 0
  private hopFill = 0
  private hopCount = 0
  private originFrame = 0
  private originSet = false
  private readonly powerRing: number[] = []
  private readonly energyRing: Float64Array
  private floorDb = Number.NaN
  private state: 'valley' | 'rise' = 'valley'
  private valleyHop = 0
  private valleyDb = Number.POSITIVE_INFINITY
  private peakHop = 0
  private peakDb = Number.NEGATIVE_INFINITY
  private pending: Onset | null = null
  private lastEmitted = Number.NEGATIVE_INFINITY

  constructor(sampleRate: number, params: Partial<DetectorParams> = {}) {
    this.sampleRate = sampleRate
    this.params = { ...DEFAULT_DETECTOR_PARAMS, ...params }
    this.hop = Math.max(16, Math.round(sampleRate * this.params.hopSeconds))
    const hopS = this.hop / sampleRate
    this.smoothHops = Math.max(1, Math.round(this.params.smoothSeconds / hopS))
    const rc = 1 / (2 * Math.PI * this.params.highpassHz)
    this.hpA = rc / (rc + 1 / sampleRate)
    this.energyRing = new Float64Array(Math.ceil(1 / hopS))
    this.applyParams()
  }

  setParams(params: Partial<DetectorParams>): void {
    this.params = { ...this.params, ...params }
    this.applyParams()
  }

  getParams(): DetectorParams {
    return { ...this.params }
  }

  /** Verarbeitet einen zusammenhängenden Block. `startFrame` des ersten Blocks legt den Nullpunkt fest. */
  process(samples: Float32Array, startFrame: number): { onsets: Onset[]; frames: FrameStat[] } {
    if (!this.originSet) {
      this.originFrame = startFrame
      this.originSet = true
    }
    const onsets: Onset[] = []
    const frames: FrameStat[] = []
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]
      const y = this.hpA * (this.prevY + x - this.prevX)
      this.prevX = x
      this.prevY = y
      this.hopSum += y * y
      this.hopFill++
      if (this.hopFill === this.hop) {
        this.finishHop(onsets, frames)
        this.hopSum = 0
        this.hopFill = 0
      }
    }
    return { onsets, frames }
  }

  /** Gibt einen noch zurückgehaltenen Einsatz frei (am Ende einer Aufnahme aufrufen). */
  flush(): Onset[] {
    if (!this.pending) return []
    const out = [this.pending]
    this.lastEmitted = this.pending.time
    this.pending = null
    return out
  }

  private applyParams(): void {
    this.holdHops = Math.max(1, Math.round(this.params.peakHoldSeconds / (this.hop / this.sampleRate)))
  }

  private hopTime(k: number): number {
    return (this.originFrame + k * this.hop) / this.sampleRate
  }

  private energyAt(k: number): number {
    return this.energyRing[k % this.energyRing.length]
  }

  private emit(onsets: Onset[], onset: Onset): void {
    onsets.push(onset)
    this.lastEmitted = onset.time
  }

  private finishHop(onsets: Onset[], frames: FrameStat[]): void {
    const p = this.params
    const k = this.hopCount++
    this.powerRing.push(this.hopSum / this.hop)
    if (this.powerRing.length > this.smoothHops) this.powerRing.shift()
    let mean = 0
    for (const v of this.powerRing) mean += v
    mean /= this.powerRing.length
    const e = 10 * Math.log10(mean + 1e-12)
    this.energyRing[k % this.energyRing.length] = e
    if (Number.isNaN(this.floorDb)) this.floorDb = e

    if (this.state === 'valley') {
      if (e < this.valleyDb) {
        this.valleyDb = e
        this.valleyHop = k
      }
      if (e >= this.valleyDb + p.riseDb && e >= this.floorDb + p.aboveFloorDb && e >= p.minLevelDb) {
        this.state = 'rise'
        this.peakHop = k
        this.peakDb = e
      }
    } else {
      if (e > this.peakDb) {
        this.peakDb = e
        this.peakHop = k
      }
      if (e <= this.peakDb - p.peakDropDb || k - this.peakHop >= this.holdHops) {
        this.confirmPeak(onsets)
        this.state = 'valley'
        this.valleyDb = e
        this.valleyHop = k
      }
    }

    // Ein zurückgehaltener Einsatz kann nicht mehr umgehängt werden, sobald jeder
    // künftige Anstieg (frühestens ab dem aktuellen Tal) ausserhalb des Merge-Fensters liegt.
    if (this.pending && this.hopTime(this.valleyHop) - this.pending.time >= p.mergeSeconds) {
      this.emit(onsets, this.pending)
      this.pending = null
    }

    const hopS = this.hop / this.sampleRate
    this.floorDb = e < this.floorDb ? e : Math.min(this.floorDb + p.floorRiseDbPerSecond * hopS, e)
    frames.push({ time: this.hopTime(k), energyDb: e, floorDb: this.floorDb })
  }

  private confirmPeak(onsets: Onset[]): void {
    const p = this.params
    const from = Math.max(this.valleyHop, this.hopCount - this.energyRing.length)
    let cross = this.peakHop
    for (let j = from; j <= this.peakHop; j++) {
      if (this.energyAt(j) >= this.peakDb - p.belowPeakDb) {
        cross = j
        break
      }
    }
    const candidate: Onset = {
      time: this.hopTime(cross),
      frame: this.originFrame + cross * this.hop,
      peakDb: this.peakDb,
    }
    const prev = this.pending
    if (prev && candidate.time - prev.time < p.mergeSeconds && candidate.peakDb >= prev.peakDb + p.mergeDb) {
      this.pending = candidate
      return
    }
    const lastTime = prev ? prev.time : this.lastEmitted
    if (candidate.time - lastTime >= p.minIoiSeconds) {
      if (prev) this.emit(onsets, prev)
      this.pending = candidate
    }
  }
}

/** Bequeme Offline-Variante für ganze Aufnahmen. */
export function detectOnsets(samples: Float32Array, sampleRate: number, params: Partial<DetectorParams> = {}): Onset[] {
  const detector = new OnsetDetector(sampleRate, params)
  const { onsets } = detector.process(samples, 0)
  return [...onsets, ...detector.flush()]
}
