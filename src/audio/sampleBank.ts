import type { SyllableId } from '../domain/types'
import { COUNT_WORDS, UI_SOUNDS, type CountWord, type SoundManifest, type SoundRef, type UiSound } from './manifest'

export type Sample = { buffer: AudioBuffer; refSeconds: number }

export type SampleBank = {
  manifest: SoundManifest
  syllable(syl: SyllableId, accent: boolean): Sample
  count(word: CountWord): Sample
  ui(name: UiSound): AudioBuffer
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sound konnte nicht geladen werden: ${url} (${res.status})`)
  return res
}

/** Lädt Manifest und alle WAVs und dekodiert sie für den gegebenen AudioContext. */
export async function loadSampleBank(ctx: BaseAudioContext, baseUrl = '/sounds/'): Promise<SampleBank> {
  const manifest = (await (await fetchOk(`${baseUrl}manifest.json`)).json()) as SoundManifest
  const decode = async (ref: SoundRef): Promise<Sample> => {
    const data = await (await fetchOk(`${baseUrl}${ref.file}`)).arrayBuffer()
    return { buffer: await ctx.decodeAudioData(data), refSeconds: ref.refSeconds }
  }

  const syllables = new Map<string, Sample>()
  await Promise.all(
    Object.entries(manifest.syllables).flatMap(([syl, refs]) => [
      decode(refs.normal).then((s) => syllables.set(`${syl}:0`, s)),
      decode(refs.accent).then((s) => syllables.set(`${syl}:1`, s)),
    ]),
  )
  const counts = new Map<CountWord, Sample>()
  await Promise.all(COUNT_WORDS.map((w) => decode(manifest.count[w]).then((s) => counts.set(w, s))))
  const ui = new Map<UiSound, AudioBuffer>()
  await Promise.all(UI_SOUNDS.map((n) => decode(manifest.ui[n]).then((s) => ui.set(n, s.buffer))))

  const get = <K, V>(map: Map<K, V>, key: K): V => {
    const value = map.get(key)
    if (!value) throw new Error(`Sound fehlt im Manifest: ${String(key)}`)
    return value
  }
  return {
    manifest,
    syllable: (syl, accent) => get(syllables, `${syl}:${accent ? 1 : 0}`),
    count: (word) => get(counts, word),
    ui: (name) => get(ui, name),
  }
}
