import type { DetectorParams } from './onset/detector'
import { WORKLET_NAME, type WorkletInMessage, type WorkletOutMessage } from './onset/messages'
import workletUrl from './onset/onset-worklet.ts?worker&url'

export type MicErrorKind = 'denied' | 'unavailable' | 'unsupported'

export class MicError extends Error {
  readonly kind: MicErrorKind
  constructor(kind: MicErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export type MicInput = {
  deviceId: string
  label: string
  setParams(params: Partial<DetectorParams>): void
  /** Neuer Detektor (z. B. vor einer Übung). Die Zeitbasis bleibt die Audio-Uhr. */
  reset(params?: Partial<DetectorParams>): void
  /** Gibt einen zurückgehaltenen letzten Einsatz frei. */
  flush(): void
  close(): void
}

const loadedContexts = new WeakSet<BaseAudioContext>()

/**
 * Öffnet das Mikrofon ohne Echo-Unterdrückung, Rauschfilter und Pegelautomatik und hängt
 * den Einsatz-Detektor (AudioWorklet) an.
 */
export async function openMic(ctx: AudioContext, onMessage: (message: WorkletOutMessage) => void): Promise<MicInput> {
  if (!navigator.mediaDevices?.getUserMedia || !ctx.audioWorklet) {
    throw new MicError('unsupported', 'Dieser Browser unterstützt die Mikrofon-Auswertung nicht. Bitte aktuellen Chrome, Firefox oder Safari verwenden.')
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })
  } catch (error) {
    const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
    throw new MicError(
      denied ? 'denied' : 'unavailable',
      denied
        ? 'Der Mikrofon-Zugriff wurde verweigert. Erlaube ihn in den Website-Einstellungen des Browsers.'
        : 'Es wurde kein Mikrofon gefunden.',
    )
  }
  if (!loadedContexts.has(ctx)) {
    await ctx.audioWorklet.addModule(workletUrl)
    loadedContexts.add(ctx)
  }
  const source = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
    channelCountMode: 'explicit',
  })
  // Stummer Ausgang, damit der Browser das Worklet sicher verarbeitet.
  const sink = ctx.createGain()
  sink.gain.value = 0
  source.connect(node).connect(sink).connect(ctx.destination)
  node.port.onmessage = (event: MessageEvent<WorkletOutMessage>) => onMessage(event.data)
  const send = (message: WorkletInMessage) => node.port.postMessage(message)

  const track = stream.getAudioTracks()[0]
  return {
    deviceId: track.getSettings().deviceId ?? '',
    label: track.label || 'Mikrofon',
    setParams: (params) => send({ type: 'params', params }),
    reset: (params) => send({ type: 'reset', params }),
    flush: () => send({ type: 'flush' }),
    close: () => {
      source.disconnect()
      node.disconnect()
      sink.disconnect()
      node.port.onmessage = null
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}
