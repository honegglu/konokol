import type { Beat, Cell, Division, SyllableId } from '../domain/types'

export const SYLLABLES: readonly SyllableId[] = ['ta', 'ka', 'ki', 'di', 'mi', 'gi', 'na', 'thom']

/** Das feste Silbenwort pro Gruppengrösse (siehe Spec 3.1). */
export const WORDS: Record<Division, readonly SyllableId[]> = {
  1: ['ta'],
  2: ['ta', 'ka'],
  3: ['ta', 'ki', 'ta'],
  4: ['ta', 'ka', 'di', 'mi'],
  5: ['ta', 'di', 'gi', 'na', 'thom'],
  6: ['ta', 'ki', 'ta', 'ta', 'ki', 'ta'],
  7: ['ta', 'ki', 'ta', 'ta', 'ka', 'di', 'mi'],
}

/** Ein Schlag, der genau das Wort seiner Unterteilung enthält. */
export function wordBeat(div: Division, accentFirst = false): Beat {
  const cells: Cell[] = WORDS[div].map((syl, i) => ({ syl, accent: accentFirst && i === 0 }))
  return { div, cells }
}

/** Anzeige einer Silbe: Gruppenanfang gross ("Ta"), sonst klein ("ki"). */
export function syllableLabel(syl: SyllableId, groupStart: boolean): string {
  return groupStart ? syl.charAt(0).toUpperCase() + syl.slice(1) : syl
}

/** Reiht Gruppen-Wörter aneinander und verteilt sie auf Schläge, z. B. [3, 3, 2] mit div 4 → Ta ki ta Ta | ki ta Ta ka. */
export function groupedBeats(groups: number[], div: Division, accent = true): Beat[] {
  const cells: Cell[] = groups.flatMap((size) => {
    if (!Number.isInteger(size) || size < 1 || size > 7) throw new Error(`Gruppengrösse ${size} wird nicht unterstützt`)
    return WORDS[size as Division].map((syl, i) => ({ syl, accent: accent && i === 0 }))
  })
  if (cells.length % div !== 0) throw new Error(`${cells.length} Zellen passen nicht in Schläge zu ${div}`)
  const beats: Beat[] = []
  for (let i = 0; i < cells.length; i += div) beats.push({ div, cells: cells.slice(i, i + div) })
  return beats
}
