import type { SyllableId } from '../domain/types'

export type CountWord = 'eins' | 'zwei' | 'drei' | 'vier'
export type UiSound = 'correct' | 'miss' | 'lessonComplete' | 'streak'

export const COUNT_WORDS: readonly CountWord[] = ['eins', 'zwei', 'drei', 'vier']
export const UI_SOUNDS: readonly UiSound[] = ['correct', 'miss', 'lessonComplete', 'streak']

export type SoundRef = {
  /** Dateiname relativ zu /sounds/ */
  file: string
  /** Wahrgenommener Einsatz (P-Center) ab Dateibeginn, in Sekunden. Für UI-Sounds 0. */
  refSeconds: number
  durationSeconds: number
}

export type SoundManifest = {
  version: 1
  sampleRate: number
  voiceId: string
  modelId: string
  generatedAt: string
  syllables: Record<SyllableId, { normal: SoundRef; accent: SoundRef }>
  count: Record<CountWord, SoundRef>
  ui: Record<UiSound, SoundRef>
}
