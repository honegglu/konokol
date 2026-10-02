import type { PreparedSyllable } from './analyze'

/**
 * Wählt einen Take: zuerst eine manuelle Vorgabe (1-basiert), sonst der erste Take mit genau
 * einem erkannten Einsatz, sonst Take 1.
 */
export function chooseTake(takes: PreparedSyllable[], override?: number): { index: number; reason: string } {
  if (takes.length === 0) throw new Error('Keine Takes vorhanden')
  if (override !== undefined) {
    if (override < 1 || override > takes.length) throw new Error(`Take ${override} gibt es nicht (1 bis ${takes.length})`)
    return { index: override - 1, reason: 'manuell gewählt' }
  }
  const clean = takes.findIndex((t) => t.onsetCount === 1)
  if (clean >= 0) return { index: clean, reason: 'erster Take mit genau einem Einsatz' }
  return { index: 0, reason: 'kein Take mit genau einem Einsatz, nehme Take 1' }
}
