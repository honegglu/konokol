import { OnsetDetector, type DetectorParams, type FrameStat } from './detector'
import { WORKLET_BLOCK, WORKLET_NAME, type WorkletInMessage, type WorkletOutMessage } from './messages'

/** Stille für Render-Quanten ohne aktiven Eingang, damit die Zeitrechnung lückenlos bleibt. */
const SILENCE = new Float32Array(128)

/**
 * Läuft im Audio-Thread: erkennt Einsätze und schickt Einsätze sofort sowie Audio und
 * Energiewerte blockweise an die Seite. Zeiten sind Frames auf der Uhr des AudioContext.
 */
class OnsetProcessor extends AudioWorkletProcessor {
  private detector = new OnsetDetector(sampleRate)
  private params: Partial<DetectorParams> = {}
  private buffer = new Float32Array(WORKLET_BLOCK)
  private fill = 0
  private bufferStart = 0
  private frames: FrameStat[] = []
  /** Epoche des letzten Resets, steht in jeder Nachricht an die Seite. */
  private epoch = 0

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<WorkletInMessage>) => this.handle(event.data)
  }

  private send(message: WorkletOutMessage, transfer: Transferable[] = []): void {
    this.port.postMessage(message, transfer)
  }

  private handle(message: WorkletInMessage): void {
    if (message.type === 'params') {
      this.params = { ...this.params, ...message.params }
      this.detector.setParams(message.params)
    } else if (message.type === 'reset') {
      this.params = { ...this.params, ...message.params }
      this.epoch = message.epoch
      this.detector = new OnsetDetector(sampleRate, this.params)
      this.fill = 0
      this.frames = []
    } else {
      const onsets = this.detector.flush()
      if (onsets.length > 0) this.send({ type: 'onsets', epoch: this.epoch, onsets })
    }
  }

  process(inputs: Float32Array[][]): boolean {
    // Ohne aktive Quelle liefert der Browser keinen Kanal. Diese Quanten trotzdem als Stille
    // verarbeiten, sonst verrutschen alle späteren Zeiten.
    const channel = inputs[0]?.[0] ?? SILENCE
    const { onsets, frames } = this.detector.process(channel, currentFrame)
    if (onsets.length > 0) this.send({ type: 'onsets', epoch: this.epoch, onsets })
    this.frames.push(...frames)
    if (this.fill === 0) this.bufferStart = currentFrame
    this.buffer.set(channel, this.fill)
    this.fill += channel.length
    if (this.fill >= WORKLET_BLOCK) {
      const samples = this.buffer
      this.send({ type: 'block', epoch: this.epoch, startFrame: this.bufferStart, samples, frames: this.frames }, [samples.buffer])
      this.buffer = new Float32Array(WORKLET_BLOCK)
      this.fill = 0
      this.frames = []
    }
    return true
  }
}

registerProcessor(WORKLET_NAME, OnsetProcessor)
