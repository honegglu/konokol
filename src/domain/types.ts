export type SyllableId = 'ta' | 'ka' | 'ki' | 'di' | 'mi' | 'gi' | 'na' | 'thom'

export type Division = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Eine Rasterzelle. `syl: null` ist eine Pause. */
export type Cell = { syl: SyllableId | null; accent?: boolean }

/** Ein Schlag (Viertel) mit `div` Unterteilungen. Es gilt `cells.length === div`. */
export type Beat = { div: Division; cells: Cell[] }

export type Pattern = {
  id: string
  title: string
  /** 4 Beats pro Takt (4/4). */
  beats: Beat[]
  /** Gruppen-Klammern über alle Zellen, Summe = Anzahl Zellen. Ohne Angabe ist jeder Schlag eine Gruppe. */
  groups?: number[]
}

/** Eine zu sprechende Silbe mit Zeitpunkt in Sekunden. */
export type ExpectedEvent = {
  t: number
  syl: SyllableId
  accent: boolean
  beatIndex: number
  cellIndex: number
  groupIndex: number
  posInGroup: number
}
