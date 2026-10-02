import { pcm16ToFloat } from '../../src/audio/dsp/wav'

/** Rohes PCM mit 24 kHz ist in allen ElevenLabs-Abos verfügbar (44,1 kHz erst ab Pro). */
export const OUTPUT_FORMAT = 'pcm_24000'
export const OUTPUT_SAMPLE_RATE = 24000
const BASE_URL = 'https://api.elevenlabs.io'

export type Voice = { voice_id: string; name: string; category: string; labels: Record<string, string> }

export type TtsOptions = {
  modelId: string
  seed?: number
  voiceSettings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class ElevenLabsClient {
  private readonly apiKey: string
  private readonly fetchFn: FetchLike

  constructor(apiKey: string, fetchFn: FetchLike = fetch) {
    if (!apiKey) throw new Error('ELEVENLABS_API fehlt. Trage den Key in .env ein (siehe .env.example).')
    this.apiKey = apiKey
    this.fetchFn = fetchFn
  }

  async listVoices(category = 'premade'): Promise<Voice[]> {
    const res = await this.request(`/v2/voices?page_size=100&category=${encodeURIComponent(category)}`, { method: 'GET' })
    const body = (await res.json()) as { voices: Voice[] }
    return body.voices
  }

  /** Text-to-Speech, Ergebnis als Float32 mit 24 kHz. */
  async tts(voiceId: string, text: string, opts: TtsOptions): Promise<Float32Array> {
    const res = await this.request(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        model_id: opts.modelId,
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts.voiceSettings ? { voice_settings: opts.voiceSettings } : {}),
      }),
    })
    return pcm16ToFloat(new Uint8Array(await res.arrayBuffer()))
  }

  /** Sound-Effekt aus einer Beschreibung, Ergebnis als Float32 mit 24 kHz. */
  async soundEffect(prompt: string, durationSeconds: number): Promise<Float32Array> {
    const res = await this.request(`/v1/sound-generation?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds, prompt_influence: 0.6 }),
    })
    return pcm16ToFloat(new Uint8Array(await res.arrayBuffer()))
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchFn(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`ElevenLabs ${init.method ?? 'GET'} ${path} fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`)
    }
    return res
  }
}
