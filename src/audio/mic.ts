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
  /** Läuft die Echo-Unterdrückung des Browsers wirklich? Die Spur meldet es, sonst gilt der angefragte Wert. */
  echoCancellation: boolean
  setParams(params: Partial<DetectorParams>): void
  /**
   * Neuer Detektor (z. B. vor einer Übung). Die Zeitbasis bleibt die Audio-Uhr.
   * Gibt die neue Epoche zurück: Das Worklet beschriftet alle folgenden Nachrichten damit. Nachrichten mit
   * einer anderen Epoche sind Nachzügler aus der Zeit vor dem Reset und gehören nicht zum neuen Lauf.
   */
  reset(params?: Partial<DetectorParams>): number
  /** Gibt einen zurückgehaltenen letzten Einsatz frei. */
  flush(): void
  close(): void
}

const loadedContexts = new WeakSet<BaseAudioContext>()

const LOAD_ERROR =
  'Die Mikrofon-Auswertung konnte nicht geladen werden. Bitte die Seite neu laden oder einen aktuellen Chrome, Firefox oder Safari verwenden.'

export type MicOptions = {
  /** Lautsprecher-Modus: Der Browser soll den Klang der App aus dem Mikrofon herausrechnen. Standard: aus. */
  echoCancellation?: boolean
}

/**
 * Öffnet das Mikrofon ohne Rauschfilter und Pegelautomatik und hängt den Einsatz-Detektor (AudioWorklet) an.
 * Die Echo-Unterdrückung ist nur auf Wunsch an (`options.echoCancellation`), sonst aus.
 */
export async function openMic(
  ctx: AudioContext,
  onMessage: (message: WorkletOutMessage) => void,
  options: MicOptions = {},
): Promise<MicInput> {
  const echoCancellation = options.echoCancellation === true
  if (!navigator.mediaDevices?.getUserMedia || !ctx.audioWorklet) {
    throw new MicError('unsupported', 'Dieser Browser unterstützt die Mikrofon-Auswertung nicht. Bitte aktuellen Chrome, Firefox oder Safari verwenden.')
  }
  // Das Worklet zuerst laden: Schlägt das fehl, gibt es keine Mikrofon-Abfrage und nichts muss freigegeben werden.
  if (!loadedContexts.has(ctx)) {
    try {
      await ctx.audioWorklet.addModule(workletUrl)
    } catch {
      throw new MicError('unsupported', LOAD_ERROR)
    }
    loadedContexts.add(ctx)
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
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
  const created: AudioNode[] = []
  try {
    const source = ctx.createMediaStreamSource(stream)
    created.push(source)
    const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
    })
    created.push(node)
    // Stummer Ausgang, damit der Browser das Worklet sicher verarbeitet.
    const sink = ctx.createGain()
    created.push(sink)
    sink.gain.value = 0
    source.connect(node).connect(sink).connect(ctx.destination)
    node.port.onmessage = (event: MessageEvent<WorkletOutMessage>) => onMessage(event.data)
    const send = (message: WorkletInMessage) => node.port.postMessage(message)
    let epoch = 0

    const track = stream.getAudioTracks()[0]
    const settings = track.getSettings()
    // Neuere Browser dürfen statt true auch einen Modus-Namen ("all", "remote-only") melden: Das heisst ebenfalls an.
    const reported = settings.echoCancellation
    return {
      deviceId: settings.deviceId ?? '',
      label: track.label || 'Mikrofon',
      echoCancellation: typeof reported === 'string' ? true : (reported ?? echoCancellation),
      setParams: (params) => send({ type: 'params', params }),
      reset: (params) => {
        epoch += 1
        send({ type: 'reset', epoch, params })
        return epoch
      },
      flush: () => send({ type: 'flush' }),
      close: () => {
        source.disconnect()
        node.disconnect()
        sink.disconnect()
        node.port.onmessage = null
        stream.getTracks().forEach((t) => t.stop())
      },
    }
  } catch {
    // Das Mikrofon darf nicht weiterlaufen (Aufnahme-Anzeige des Browsers), wenn der Aufbau scheitert.
    stream.getTracks().forEach((t) => t.stop())
    for (const node of created) {
      try {
        node.disconnect()
      } catch {
        // Aufräumen darf nicht erneut scheitern.
      }
    }
    throw new MicError('unsupported', LOAD_ERROR)
  }
}
