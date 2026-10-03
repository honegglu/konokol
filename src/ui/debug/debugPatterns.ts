import { groupedBeats, wordBeat } from '../../content/syllables'
import type { Beat, Division, Pattern } from '../../domain/types'

const bar = (div: Division): Beat[] => [1, 2, 3, 4].map(() => wordBeat(div, true))

/** Patterns für die Audio-Testseite (keine Lerninhalte). */
export const DEBUG_PATTERNS: Pattern[] = [
  { id: 'ta', title: 'Ta (Viertel)', beats: bar(1) },
  { id: 'taka', title: 'Ta-ka (Achtel)', beats: bar(2) },
  { id: 'takita', title: 'Ta-ki-ta (Triolen)', beats: bar(3) },
  { id: 'takadimi', title: 'Ta-ka-di-mi (16tel)', beats: bar(4) },
  { id: 'tadiginathom', title: 'Ta-di-gi-na-thom (Quintolen)', beats: bar(5) },
  { id: 'septolen', title: 'Ta-ki-ta-Ta-ka-di-mi (Septolen)', beats: bar(7) },
  { id: '332', title: '3+3+2 zweimal (16tel)', beats: groupedBeats([3, 3, 2, 3, 3, 2], 4), groups: [3, 3, 2, 3, 3, 2] },
]

/** Vier Viertel, jedes betont (wie `bar(1)`), für Kopfhörer-Check und Latenz-Messung. */
export const CALIBRATION_PATTERN: Pattern = { id: 'calibration', title: 'Kalibrierung', beats: bar(1) }
