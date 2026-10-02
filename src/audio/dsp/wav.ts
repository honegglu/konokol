/** Rohes PCM (16 Bit, signed, little-endian, mono) nach Float32 im Bereich -1..1. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const n = Math.floor(bytes.byteLength / 2)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return out
}

/** Mono-WAV mit 16 Bit PCM. Werte ausserhalb -1..1 werden begrenzt. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, tag.charCodeAt(i))
  }
  writeTag(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeTag(8, 'WAVE')
  writeTag(12, 'fmt ')
  view.setUint32(16, 16, true) // Grösse fmt-Chunk
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // Byte-Rate
  view.setUint16(32, 2, true) // Block-Align
  view.setUint16(34, 16, true) // Bits pro Sample
  writeTag(36, 'data')
  view.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true)
  }
  return new Uint8Array(buffer)
}

/** Liest 16-Bit-PCM-WAV (mono oder mehrkanalig, Kanäle werden gemittelt). */
export function decodeWav(bytes: Uint8Array): { sampleRate: number; samples: Float32Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Keine WAV-Datei')
  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bits = 0
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      const format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
      if (format !== 1 || bits !== 16) throw new Error(`Nur 16-Bit-PCM wird unterstützt (Format ${format}, ${bits} Bit)`)
    } else if (id === 'data') {
      if (!sampleRate) throw new Error('fmt-Chunk fehlt vor data-Chunk')
      const frames = Math.floor(size / (2 * channels))
      const samples = new Float32Array(frames)
      for (let f = 0; f < frames; f++) {
        let sum = 0
        for (let c = 0; c < channels; c++) sum += view.getInt16(body + (f * channels + c) * 2, true) / 32768
        samples[f] = sum / channels
      }
      return { sampleRate, samples }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('data-Chunk fehlt')
}
