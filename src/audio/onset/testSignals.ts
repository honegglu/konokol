/** Synthetische Testsignale für die Einsatz-Erkennung (nur in Tests verwendet). */
import { fromDb } from '../dsp/level'
import { detectOnsets } from './detector'

/** Deterministischer Zufall (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normalverteiltes Rauschen (Box-Muller). */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

export type SynthSyllableOptions = { vowelDb?: number; burstDb?: number; seed?: number }

/**
 * Silben-Attrappe: 6 ms Rausch-Knall (Konsonant), 35 ms Lücke, 150 ms Vokal
 * (Obertonreihe auf 140 Hz, 12 ms Anstieg, 40 ms Ausklang).
 */
export function synthSyllable(sampleRate: number, opts: SynthSyllableOptions = {}): Float32Array {
  const { vowelDb = -8, burstDb = -28, seed = 1 } = opts
  const rand = prng(seed)
  const burstN = Math.round(0.006 * sampleRate)
  const gapN = Math.round(0.035 * sampleRate)
  const vowelN = Math.round(0.15 * sampleRate)
  const out = new Float32Array(burstN + gapN + vowelN)
  const burstAmp = fromDb(burstDb)
  for (let i = 0; i < burstN; i++) out[i] = gaussian(rand) * burstAmp * (1 - i / burstN)
  const attack = Math.round(0.012 * sampleRate)
  const release = Math.round(0.04 * sampleRate)
  const vowel = new Float32Array(vowelN)
  let max = 0
  for (let i = 0; i < vowelN; i++) {
    const t = i / sampleRate
    let v = 0
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * 140 * h * t) / h
    const env = Math.min(1, i / attack, (vowelN - i) / release)
    vowel[i] = v * env
    max = Math.max(max, Math.abs(vowel[i]))
  }
  const vowelAmp = fromDb(vowelDb) / max
  for (let i = 0; i < vowelN; i++) out[burstN + gapN + i] = vowel[i] * vowelAmp
  return out
}

/** Einsatzpunkt, den der Detektor in einer isolierten Silbe findet (Sekunden ab Silbenbeginn). */
export function referencePoint(syllable: Float32Array, sampleRate: number): number {
  const lead = Math.round(0.2 * sampleRate)
  const padded = new Float32Array(lead + syllable.length + Math.round(0.3 * sampleRate))
  padded.set(syllable, lead)
  addNoise(padded, -75, 99)
  const onsets = detectOnsets(padded, sampleRate)
  if (onsets.length === 0) throw new Error('Kein Einsatz in isolierter Silbe gefunden')
  return onsets[0].time - lead / sampleRate
}

export function addNoise(samples: Float32Array, noiseDb: number, seed: number): void {
  const rand = prng(seed)
  const amp = fromDb(noiseDb)
  for (let i = 0; i < samples.length; i++) samples[i] += gaussian(rand) * amp
}

/**
 * Setzt Silben so, dass ihr Referenzpunkt genau auf `targets` liegt. Jede Silbe wird beim
 * Beginn der nächsten abgeschnitten (5 ms Ausblenden), wie in der echten Wiedergabe.
 */
export function placeSyllables(
  sampleRate: number,
  targets: number[],
  syllables: Float32Array[],
  refs: number[],
  totalSeconds: number,
): Float32Array {
  const out = new Float32Array(Math.round(totalSeconds * sampleRate))
  const starts = targets.map((t, i) => Math.round((t - refs[i % refs.length]) * sampleRate))
  const fade = Math.round(0.005 * sampleRate)
  starts.forEach((start, i) => {
    const syl = syllables[i % syllables.length]
    const end = Math.min(start + syl.length, i + 1 < starts.length ? starts[i + 1] : Infinity, out.length)
    const len = end - start
    for (let j = 0; j < len; j++) {
      const g = j >= len - fade ? (len - j) / fade : 1
      out[start + j] += syl[j] * g
    }
  })
  return out
}

export type MatchStats = { matched: number; extras: number; errors: number[] }

/** Ordnet jedem Ziel den nächsten Einsatz innerhalb ±halber Rasterschritt zu. */
export function matchStats(targets: number[], onsetTimes: number[], step: number): MatchStats {
  const used = new Set<number>()
  const errors: number[] = []
  for (const t of targets) {
    let best = -1
    for (let j = 0; j < onsetTimes.length; j++) {
      if (used.has(j)) continue
      if (best === -1 || Math.abs(onsetTimes[j] - t) < Math.abs(onsetTimes[best] - t)) best = j
    }
    if (best !== -1 && Math.abs(onsetTimes[best] - t) < step / 2) {
      used.add(best)
      errors.push(onsetTimes[best] - t)
    }
  }
  return { matched: errors.length, extras: onsetTimes.length - used.size, errors }
}
