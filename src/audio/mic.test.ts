import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MicError, openMic } from './mic'

// Die Worklet-URL kommt in der App von Vite (`?worker&url`); im Test reicht ein fester Wert.
vi.mock('./onset/onset-worklet.ts?worker&url', () => ({ default: '/worklet.js' }))

type FakeTrack = { stop: ReturnType<typeof vi.fn>; label: string; getSettings: () => { deviceId: string } }

function fakeStream(trackCount = 1) {
  const tracks: FakeTrack[] = Array.from({ length: trackCount }, () => ({
    stop: vi.fn(),
    label: 'Test-Mikrofon',
    getSettings: () => ({ deviceId: 'dev-1' }),
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
})
