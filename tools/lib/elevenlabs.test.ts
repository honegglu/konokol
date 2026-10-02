import { describe, expect, it, vi } from 'vitest'
import { ElevenLabsClient } from './elevenlabs'

function okResponse(body: BodyInit): Response {
  return new Response(body, { status: 200 })
}

describe('ElevenLabsClient', () => {
  it('verlangt einen API-Key', () => {
    expect(() => new ElevenLabsClient('')).toThrow('ELEVENLABS_API fehlt')
  })

  it('ruft Text-to-Speech mit PCM 24 kHz auf und liefert Float32', async () => {
    const fetchFn = vi.fn(async () => okResponse(new Uint8Array([0x00, 0x40, 0x00, 0xc0])))
    const client = new ElevenLabsClient('key-123', fetchFn)
    const samples = await client.tts('voice-1', 'Tah.', { modelId: 'eleven_multilingual_v2', seed: 3 })
    expect(Array.from(samples)).toEqual([0.5, -0.5])
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=pcm_24000')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'xi-api-key': 'key-123' })
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Tah.', model_id: 'eleven_multilingual_v2', seed: 3 })
  })

  it('ruft Sound-Effekte mit Dauer auf', async () => {
    const fetchFn = vi.fn(async () => okResponse(new Uint8Array(4)))
    const client = new ElevenLabsClient('k', fetchFn)
    await client.soundEffect('short marimba chime', 0.8)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_24000')
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'short marimba chime', duration_seconds: 0.8 })
  })

  it('listet Stimmen', async () => {
    const fetchFn = vi.fn(async () => okResponse(JSON.stringify({ voices: [{ voice_id: 'a', name: 'River', category: 'premade', labels: {} }] })))
    const voices = await new ElevenLabsClient('k', fetchFn).listVoices()
    expect(voices[0].name).toBe('River')
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain('/v2/voices?page_size=100&category=premade')
  })

  it('meldet API-Fehler mit Status und Text', async () => {
    const fetchFn = vi.fn(async () => new Response('{"detail":"quota_exceeded"}', { status: 401 }))
    const client = new ElevenLabsClient('k', fetchFn)
    await expect(client.tts('v', 'Tah.', { modelId: 'm' })).rejects.toThrow(/\(401\).*quota_exceeded/)
  })
})
