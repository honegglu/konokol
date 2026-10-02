export function toDb(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, 1e-12))
}

export function fromDb(db: number): number {
  return 10 ** (db / 20)
}

export function peak(samples: Float32Array): number {
  let p = 0
  for (const s of samples) p = Math.max(p, Math.abs(s))
  return p
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

/** Neue Kopie, deren Spitzenpegel `targetDb` dBFS beträgt. */
export function normalizePeak(samples: Float32Array, targetDb: number): Float32Array {
  const p = peak(samples)
  if (p === 0) return samples.slice()
  const gain = fromDb(targetDb) / p
  return samples.map((s) => s * gain)
}

/** Neue Kopie mit linearem Ausblenden über die letzten `ms` Millisekunden. */
export function fadeOut(samples: Float32Array, sampleRate: number, ms: number): Float32Array {
  const out = samples.slice()
  const n = Math.min(out.length, Math.round((sampleRate * ms) / 1000))
  for (let i = 0; i < n; i++) out[out.length - n + i] *= 1 - (i + 1) / n
  return out
}
