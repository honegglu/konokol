import { describe, expect, it } from 'vitest'
import { onsetsInTargetRange } from './testSignals'

describe('onsetsInTargetRange', () => {
  // Zielzeiten 1 und 2 s, Schritt 0,5 s: bewertet wird [0,75; 2,25]. Die Werte sind in Binärdarstellung exakt.
  const targets = [1, 1.5, 2]
  const step = 0.5

  it('lässt Einsätze vor dem ersten und nach dem letzten Ziel weg (Einzählen, Stopp-Klick, angefangener Durchgang)', () => {
    expect(onsetsInTargetRange([0.2, 0.7, 1.1, 1.6, 2.1, 2.3, 4], targets, step)).toEqual([1.1, 1.6, 2.1])
  })

  it('behält die Ränder bei genau ±halber Schritt', () => {
    expect(onsetsInTargetRange([0.75, 2.25], targets, step)).toEqual([0.75, 2.25])
    expect(onsetsInTargetRange([0.7499, 2.2501], targets, step)).toEqual([])
  })

  it('liefert nichts ohne Ziele', () => {
    expect(onsetsInTargetRange([1, 2], [], step)).toEqual([])
  })
})
