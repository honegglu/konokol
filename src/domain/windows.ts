export type Tolerance = 'locker' | 'normal' | 'streng'

const FACTOR: Record<Tolerance, number> = { locker: 1.4, normal: 1, streng: 0.7 }

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

/** Zeitfenster nach Spec 5.1, in Sekunden. `step` = Dauer einer Unterteilung. */
export function timingWindows(step: number, tolerance: Tolerance = 'normal'): { tight: number; loose: number } {
  const f = FACTOR[tolerance]
  return { tight: clamp(0.2 * step, 0.025, 0.05) * f, loose: clamp(0.45 * step, 0.05, 0.12) * f }
}

export type TimingClass = 'hit' | 'early' | 'late' | 'miss'

/** `offset` = gesprochen minus erwartet (negativ = zu früh), `null` = nicht gefunden. */
export function classifyOffset(offset: number | null, windows: { tight: number; loose: number }): TimingClass {
  if (offset === null || Math.abs(offset) > windows.loose) return 'miss'
  if (Math.abs(offset) <= windows.tight) return 'hit'
  return offset < 0 ? 'early' : 'late'
}
