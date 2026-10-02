/** Sammelt Mikrofon-Blöcke zu einer Aufnahme. Lücken (z. B. verlorene Blöcke) werden mit Stille gefüllt. */
export class Recorder {
  readonly sampleRate: number
  private chunks: Float32Array[] = []
  private firstFrame: number | null = null
  private nextFrame = 0
  private total = 0

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate
  }

  push(startFrame: number, samples: Float32Array): void {
    if (this.firstFrame === null) {
      this.firstFrame = startFrame
      this.nextFrame = startFrame
    }
    if (startFrame < this.nextFrame) return // doppelt oder veraltet
    if (startFrame > this.nextFrame) {
      const gap = new Float32Array(startFrame - this.nextFrame)
      this.chunks.push(gap)
      this.total += gap.length
    }
    this.chunks.push(samples)
    this.total += samples.length
    this.nextFrame = startFrame + samples.length
  }

  /** Audio-Zeit des ersten Samples, `null` solange leer. */
  get startTime(): number | null {
    return this.firstFrame === null ? null : this.firstFrame / this.sampleRate
  }

  get durationSeconds(): number {
    return this.total / this.sampleRate
  }

  toFloat32(): Float32Array {
    const out = new Float32Array(this.total)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }

  clear(): void {
    this.chunks = []
    this.firstFrame = null
    this.nextFrame = 0
    this.total = 0
  }
}
