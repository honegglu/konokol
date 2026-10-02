import type { ExpectedEvent, Pattern } from './types'

export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function cellCount(pattern: Pattern): number {
  return pattern.beats.reduce((n, beat) => n + beat.cells.length, 0)
}

export function patternDuration(pattern: Pattern, bpm: number): number {
  return pattern.beats.length * beatDuration(bpm)
}

/** Dauer der feinsten Unterteilung im Pattern, in Sekunden. */
export function gridStep(pattern: Pattern, bpm: number): number {
  const maxDiv = Math.max(...pattern.beats.map((beat) => beat.div))
  return beatDuration(bpm) / maxDiv
}

/** Liefert Fehlermeldungen (Deutsch). Leeres Array = gültig. */
export function validatePattern(pattern: Pattern): string[] {
  const errors: string[] = []
  if (pattern.beats.length === 0 || pattern.beats.length % 4 !== 0) {
    errors.push(`${pattern.id}: Anzahl Schläge (${pattern.beats.length}) ist kein Vielfaches von 4`)
  }
  pattern.beats.forEach((beat, i) => {
    if (beat.cells.length !== beat.div) {
      errors.push(`${pattern.id}: Schlag ${i + 1} hat ${beat.cells.length} Zellen statt ${beat.div}`)
    }
  })
  if (pattern.groups) {
    const sum = pattern.groups.reduce((a, b) => a + b, 0)
    if (sum !== cellCount(pattern)) {
      errors.push(`${pattern.id}: Gruppen ergeben ${sum} Zellen statt ${cellCount(pattern)}`)
    }
  }
  return errors
}

function locateGroup(
  groups: number[] | undefined,
  flatIndex: number,
  beatIndex: number,
  cellIndex: number,
): { groupIndex: number; posInGroup: number } {
  if (!groups) return { groupIndex: beatIndex, posInGroup: cellIndex }
  let start = 0
  for (let g = 0; g < groups.length; g++) {
    if (flatIndex < start + groups[g]) return { groupIndex: g, posInGroup: flatIndex - start }
    start += groups[g]
  }
  throw new Error(`Gruppen decken Zelle ${flatIndex} nicht ab`)
}

/** Alle gesprochenen Silben eines Durchgangs mit Zeitpunkt (Pausen werden übersprungen). */
export function expectedEvents(pattern: Pattern, bpm: number, offset = 0): ExpectedEvent[] {
  const errors = validatePattern(pattern)
  if (errors.length > 0) throw new Error(errors.join('; '))
  const bd = beatDuration(bpm)
  const events: ExpectedEvent[] = []
  let flat = 0
  pattern.beats.forEach((beat, beatIndex) => {
    beat.cells.forEach((cell, cellIndex) => {
      const { groupIndex, posInGroup } = locateGroup(pattern.groups, flat, beatIndex, cellIndex)
      if (cell.syl !== null) {
        events.push({
          t: offset + beatIndex * bd + (cellIndex * bd) / beat.div,
          syl: cell.syl,
          accent: cell.accent === true,
          beatIndex,
          cellIndex,
          groupIndex,
          posInGroup,
        })
      }
      flat++
    })
  })
  return events
}
