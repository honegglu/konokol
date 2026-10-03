import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MicError, openMic } from './mic'

// Die Worklet-URL kommt in der App von Vite (`?worker&url`); im Test reicht ein fester Wert.
vi.mock('./onset/onset-worklet.ts?worker&url', () => ({ default: '/worklet.js' }))

type FakeSettings = { deviceId: string; echoCancellation?: boolean | string }
type FakeTrack = { stop: ReturnType<typeof vi.fn>; label: string; getSettings: () => FakeSettings }

/** `settings`: Was der Browser über die Spur meldet (z. B. `echoCancellation`). Ohne Angabe fehlt der Eintrag. */
function fakeStream(trackCount = 1, settings: Partial<FakeSettings> = {}) {
  const tracks: FakeTrack[] = Array.from({ length: trackCount }, () => ({
    stop: vi.fn(),
    label: 'Test-Mikrofon',
    getSettings: () => ({ deviceId: 'dev-1', ...settings }),
  }))
  return { tracks, stream: { getTracks: () => tracks, getAudioTracks: () => tracks } }
}

function fakeNode() {
  const node = { connect: vi.fn(), disconnect: vi.fn() }
  node.connect.mockReturnValue(node)
  return node
}

function fakeContext(addModule: () => Promise<void>) {
  return {
    audioWorklet: { addModule: vi.fn(addModule) },
    destination: {},
    createMediaStreamSource: vi.fn(() => fakeNode()),
    createGain: vi.fn(() => ({ ...fakeNode(), gain: { value: 1 } })),
  }
}

const asContext = (ctx: ReturnType<typeof fakeContext>) => ctx as unknown as AudioContext

describe('openMic', () => {
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMedia = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('meldet "unsupported" und fragt nicht nach dem Mikrofon, wenn das Worklet nicht lädt', async () => {
    const ctx = fakeContext(() => Promise.reject(new DOMException('Unable to load a worklet', 'AbortError')))
    const error = await openMic(asContext(ctx), () => {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MicError)
    expect((error as MicError).kind).toBe('unsupported')
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('gibt das Mikrofon frei und meldet "unsupported", wenn der Worklet-Knoten nicht entsteht', async () => {
    const { stream, tracks } = fakeStream(2)
    getUserMedia.mockResolvedValue(stream)
    vi.stubGlobal(
      'AudioWorkletNode',
      class {
        constructor() {
          throw new DOMException('Processor not registered', 'InvalidStateError')
        }
      },
    )
    const ctx = fakeContext(() => Promise.resolve())
    const error = await openMic(asContext(ctx), () => {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MicError)
    expect((error as MicError).kind).toBe('unsupported')
    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('meldet "denied", wenn der Zugriff verweigert wird', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    const ctx = fakeContext(() => Promise.resolve())
    const error = await openMic(asContext(ctx), () => {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MicError)
    expect((error as MicError).kind).toBe('denied')
  })

  it('nummeriert Resets fortlaufend, gibt die Epoche zurück und schickt sie an das Worklet', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream)
    const posted: unknown[] = []
    vi.stubGlobal(
      'AudioWorkletNode',
      class {
        port = { postMessage: (message: unknown) => posted.push(message), onmessage: null }
        disconnect() {}
      },
    )
    const mic = await openMic(asContext(fakeContext(() => Promise.resolve())), () => {})
    expect(mic.reset({ riseDb: 5 })).toBe(1)
    expect(mic.reset()).toBe(2)
    expect(posted).toEqual([
      { type: 'reset', epoch: 1, params: { riseDb: 5 } },
      { type: 'reset', epoch: 2, params: undefined },
    ])
  })

  describe('Echo-Unterdrückung', () => {
    // Der Worklet-Knoten wird nur gebraucht, damit `openMic` bis zum Ende durchläuft.
    function stubWorkletNode() {
      vi.stubGlobal(
        'AudioWorkletNode',
        class {
          port = { postMessage: () => {}, onmessage: null }
          disconnect() {}
        },
      )
    }
    const requestedAudio = () => (getUserMedia.mock.calls[0][0] as { audio: Record<string, unknown> }).audio

    it('fragt ohne Option wie bisher ohne Echo-Unterdrückung an', async () => {
      getUserMedia.mockResolvedValue(fakeStream().stream)
      stubWorkletNode()
      await openMic(asContext(fakeContext(() => Promise.resolve())), () => {})
      expect(requestedAudio()).toEqual({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 })
    })

    it('fragt mit der Option Echo-Unterdrückung an, aber weiterhin ohne Rauschfilter und Pegelautomatik', async () => {
      getUserMedia.mockResolvedValue(fakeStream().stream)
      stubWorkletNode()
      await openMic(asContext(fakeContext(() => Promise.resolve())), () => {}, { echoCancellation: true })
      expect(requestedAudio()).toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 })
    })

    it('meldet, was die Spur wirklich tut, auch wenn der Browser die Anfrage nicht erfüllt', async () => {
      getUserMedia.mockResolvedValue(fakeStream(1, { echoCancellation: false }).stream)
      stubWorkletNode()
      const refused = await openMic(asContext(fakeContext(() => Promise.resolve())), () => {}, { echoCancellation: true })
      expect(refused.echoCancellation).toBe(false)

      getUserMedia.mockResolvedValue(fakeStream(1, { echoCancellation: true }).stream)
      const granted = await openMic(asContext(fakeContext(() => Promise.resolve())), () => {}, { echoCancellation: true })
      expect(granted.echoCancellation).toBe(true)
    })

    it('versteht einen gemeldeten Modus-Namen als "an"', async () => {
      getUserMedia.mockResolvedValue(fakeStream(1, { echoCancellation: 'all' }).stream)
      stubWorkletNode()
      const mic = await openMic(asContext(fakeContext(() => Promise.resolve())), () => {}, { echoCancellation: true })
      expect(mic.echoCancellation).toBe(true)
    })

    it('nimmt den angefragten Wert, wenn der Browser nichts meldet', async () => {
      getUserMedia.mockResolvedValue(fakeStream().stream)
      stubWorkletNode()
      const off = await openMic(asContext(fakeContext(() => Promise.resolve())), () => {})
      expect(off.echoCancellation).toBe(false)
      const on = await openMic(asContext(fakeContext(() => Promise.resolve())), () => {}, { echoCancellation: true })
      expect(on.echoCancellation).toBe(true)
    })
  })
})
