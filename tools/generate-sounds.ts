/**
 * Erzeugt die Sounds der App mit ElevenLabs.
 *
 *   npm run sounds -- voices   Hörproben der Kandidaten-Stimmen nach tools/.audition/
 *   npm run sounds -- build    Alle Silben, Einzählwörter und UI-Sounds nach public/sounds/
 *   npm run sounds -- build --only <syllables|count|ui>
 *                              Nur die genannten Gruppen neu erzeugen, der Rest des Manifests bleibt
 *                              unverändert. Mehrfach (--only count --only ui) oder kommagetrennt
 *                              (--only syllables,ui) möglich.
 *
 * Liest ELEVENLABS_API aus der Umgebung oder aus .env.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizePeak } from '../src/audio/dsp/level'
import { encodeWav16 } from '../src/audio/dsp/wav'
import { COUNT_WORDS, UI_SOUNDS, type CountWord, type SoundManifest, type SoundRef, type UiSound } from '../src/audio/manifest'
import { SYLLABLES } from '../src/content/syllables'
import type { SyllableId } from '../src/domain/types'
import { prepareSyllable, prepareUiSound, type PreparedSyllable } from './lib/analyze'
import { parseBuildArgs, type BuildGroup } from './lib/args'
import { ElevenLabsClient, OUTPUT_SAMPLE_RATE } from './lib/elevenlabs'
import { chooseTake } from './lib/takes'

type Config = {
  voiceId: string
  modelId: string
  takes: number
  auditionVoiceIds: string[]
  auditionText: string
  syllables: Record<SyllableId, { normal: string; accent: string }>
  count: Record<CountWord, string>
  ui: Record<UiSound, { prompt: string; seconds: number }>
  levels: { normalPeakDb: number; accentPeakDb: number; countPeakDb: number; uiPeakDb: number }
  takeOverrides: Record<string, number>
}

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'sounds')
const AUDITION_DIR = path.join(ROOT, 'tools', '.audition')
const USAGE = 'Aufruf: npm run sounds -- voices | build [--only <syllables|count|ui>]'
/** Einzählwörter werden im Spiel nie abgewürgt und dürfen ausklingen (Standard der Silben: 0.13 s). */
const COUNT_TAIL_SECONDS = 0.45

async function loadConfig(): Promise<Config> {
  return JSON.parse(await readFile(path.join(ROOT, 'tools', 'sounds.config.json'), 'utf8')) as Config
}

function client(): ElevenLabsClient {
  const envFile = path.join(ROOT, '.env')
  if (!process.env.ELEVENLABS_API && existsSync(envFile)) process.loadEnvFile(envFile)
  return new ElevenLabsClient(process.env.ELEVENLABS_API ?? '')
}

async function writeWav(file: string, samples: Float32Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, encodeWav16(samples, OUTPUT_SAMPLE_RATE))
}

function soundRef(file: string, samples: Float32Array, refSeconds: number): SoundRef {
  return { file, refSeconds: Number(refSeconds.toFixed(4)), durationSeconds: Number((samples.length / OUTPUT_SAMPLE_RATE).toFixed(4)) }
}

async function voices(config: Config): Promise<void> {
  const api = client()
  const all = await api.listVoices('premade')
  console.log('Verfügbare Standard-Stimmen:')
  for (const v of all) console.log(`  ${v.voice_id}  ${v.name}  (${Object.values(v.labels).join(', ')})`)
  for (const id of config.auditionVoiceIds) {
    const name = all.find((v) => v.voice_id === id)?.name.split(' ')[0] ?? 'stimme'
    const samples = normalizePeak(await api.tts(id, config.auditionText, { modelId: config.modelId }), -3)
    const file = path.join(AUDITION_DIR, `voice-${name.toLowerCase()}-${id}.wav`)
    await writeWav(file, samples)
    console.log(`Hörprobe: ${path.relative(ROOT, file)}`)
  }
  console.log('\nHöre die Proben an, trage die gewählte voiceId in tools/sounds.config.json ein und starte dann "build".')
}

async function renderSyllable(
  api: ElevenLabsClient,
  config: Config,
  key: string,
  text: string,
  peakDb: number,
  tailSeconds?: number,
): Promise<PreparedSyllable> {
  const takes: PreparedSyllable[] = []
  for (let take = 1; take <= config.takes; take++) {
    const raw = await api.tts(config.voiceId, text, { modelId: config.modelId, seed: take })
    const prepared = prepareSyllable(raw, OUTPUT_SAMPLE_RATE, { peakDb, tailSeconds })
    takes.push(prepared)
    await writeWav(path.join(AUDITION_DIR, 'takes', `${key}-${take}.wav`), prepared.samples)
  }
  const choice = chooseTake(takes, config.takeOverrides[key])
  const chosen = takes[choice.index]
  console.log(`  ${key.padEnd(12)} Take ${choice.index + 1} (${choice.reason}), Einsatz ${(chosen.refSeconds * 1000).toFixed(1)} ms`)
  return chosen
}

async function loadManifest(config: Config): Promise<SoundManifest> {
  const file = path.join(OUT_DIR, 'manifest.json')
  if (!existsSync(file)) throw new Error('Mit --only braucht es ein bestehendes public/sounds/manifest.json. Zuerst einmal ohne --only bauen.')
  const manifest = JSON.parse(await readFile(file, 'utf8')) as SoundManifest
  if (manifest.voiceId !== config.voiceId || manifest.modelId !== config.modelId) {
    throw new Error('voiceId/modelId in tools/sounds.config.json weichen vom bestehenden Manifest ab. Mit --only würden Stimmen gemischt; ohne --only komplett neu bauen.')
  }
  return manifest
}

async function build(config: Config, groups: Set<BuildGroup>): Promise<void> {
  if (!config.voiceId) throw new Error('voiceId in tools/sounds.config.json ist leer. Zuerst "voices" ausführen und eine Stimme wählen.')
  const partial = groups.size < 3
  const previous = partial ? await loadManifest(config) : undefined
  const api = client()
  const syllables = previous?.syllables ?? ({} as SoundManifest['syllables'])
  const count = previous?.count ?? ({} as SoundManifest['count'])
  const ui = previous?.ui ?? ({} as SoundManifest['ui'])

  if (groups.has('syllables')) {
    console.log('Silben:')
    for (const syl of SYLLABLES) {
      const texts = config.syllables[syl]
      const normal = await renderSyllable(api, config, `${syl}.normal`, texts.normal, config.levels.normalPeakDb)
      const accent = await renderSyllable(api, config, `${syl}.accent`, texts.accent, config.levels.accentPeakDb)
      await writeWav(path.join(OUT_DIR, `syl-${syl}.wav`), normal.samples)
      await writeWav(path.join(OUT_DIR, `syl-${syl}-accent.wav`), accent.samples)
      syllables[syl] = {
        normal: soundRef(`syl-${syl}.wav`, normal.samples, normal.refSeconds),
        accent: soundRef(`syl-${syl}-accent.wav`, accent.samples, accent.refSeconds),
      }
    }
  }

  if (groups.has('count')) {
    console.log('Einzählen:')
    for (const word of COUNT_WORDS) {
      const prepared = await renderSyllable(api, config, `count.${word}`, config.count[word], config.levels.countPeakDb, COUNT_TAIL_SECONDS)
      await writeWav(path.join(OUT_DIR, `count-${word}.wav`), prepared.samples)
      count[word] = soundRef(`count-${word}.wav`, prepared.samples, prepared.refSeconds)
    }
  }

  if (groups.has('ui')) {
    console.log('UI-Sounds:')
    for (const name of UI_SOUNDS) {
      const spec = config.ui[name]
      const raw = await api.soundEffect(spec.prompt, Math.max(0.5, spec.seconds))
      const samples = prepareUiSound(raw, OUTPUT_SAMPLE_RATE, config.levels.uiPeakDb, spec.seconds + 0.2)
      await writeWav(path.join(OUT_DIR, `ui-${name}.wav`), samples)
      ui[name] = soundRef(`ui-${name}.wav`, samples, 0)
      console.log(`  ${name}`)
    }
  }

  const manifest: SoundManifest = {
    version: 1,
    sampleRate: OUTPUT_SAMPLE_RATE,
    voiceId: config.voiceId,
    modelId: config.modelId,
    generatedAt: new Date().toISOString(),
    syllables,
    count,
    ui,
  }
  await writeFile(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\nFertig: ${path.relative(ROOT, OUT_DIR)}/manifest.json. Einzelne Takes zum Anhören liegen in tools/.audition/takes/.`)
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const config = await loadConfig()
  if (command === 'voices') await voices(config)
  else if (command === 'build') await build(config, parseBuildArgs(process.argv.slice(3)).groups)
  else {
    console.error(USAGE)
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
