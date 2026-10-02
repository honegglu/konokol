import { describe, expect, it } from 'vitest'
import { Recorder } from './recorder'

describe('Recorder', () => {
  it('hängt zusammenhängende Blöcke aneinander', () => {
    const rec = new Recorder(1000)
    rec.push(500, Float32Array.from([1, 2]))
    rec.push(502, Float32Array.from([3]))
    expect(Array.from(rec.toFloat32())).toEqual([1, 2, 3])
    expect(rec.startTime).toBe(0.5)
    expect(rec.durationSeconds).toBe(0.003)
  })

  it('füllt Lücken mit Stille und ignoriert alte Blöcke', () => {
    const rec = new Recorder(1000)
    rec.push(0, Float32Array.from([1]))
    rec.push(3, Float32Array.from([2]))
    rec.push(1, Float32Array.from([9]))
    expect(Array.from(rec.toFloat32())).toEqual([1, 0, 0, 2])
  })

  it('lässt sich leeren', () => {
    const rec = new Recorder(1000)
    rec.push(10, Float32Array.from([1]))
    rec.clear()
    expect(rec.startTime).toBeNull()
    expect(rec.toFloat32()).toHaveLength(0)
  })
})
