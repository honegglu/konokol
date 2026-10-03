import type { DetectorParams } from '../audio/onset/detector'

/**
 * Kleine Speicherstellen für Phase 2. Ab Plan 3 wandern Kalibrierung und Detektor-Werte
 * in den versionierten Speicherstand (`ProgressStore`, Spec 9.4).
 */

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type CalibrationRecord = {
  latencySeconds: number
  spreadSeconds: number
  deviceId: string
  deviceLabel: string
  measuredAt: string
  headphonesConfirmed: boolean
}

const CALIBRATION_KEY = 'taka:calibration:v1'
const DETECTOR_KEY = 'taka:detector:v1'
const SPEAKER_MODE_KEY = 'taka:speakerMode:v1'

function read<T>(storage: KeyValueStorage, key: string, valid: (value: unknown) => value is T): T | null {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    return valid(value) ? value : null
  } catch {
    return null
  }
}

function isCalibration(value: unknown): value is CalibrationRecord {
  const v = value as CalibrationRecord
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.latencySeconds === 'number' &&
    typeof v.spreadSeconds === 'number' &&
    typeof v.deviceId === 'string' &&
    typeof v.deviceLabel === 'string' &&
    typeof v.measuredAt === 'string' &&
    typeof v.headphonesConfirmed === 'boolean'
  )
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isParams(value: unknown): value is Partial<DetectorParams> {
  return typeof value === 'object' && value !== null && Object.values(value).every((v) => typeof v === 'number')
}

export function loadCalibration(storage: KeyValueStorage = localStorage): CalibrationRecord | null {
  return read(storage, CALIBRATION_KEY, isCalibration)
}

export function saveCalibration(record: CalibrationRecord, storage: KeyValueStorage = localStorage): void {
  storage.setItem(CALIBRATION_KEY, JSON.stringify(record))
}

export function loadDetectorParams(storage: KeyValueStorage = localStorage): Partial<DetectorParams> {
  return read(storage, DETECTOR_KEY, isParams) ?? {}
}

export function saveDetectorParams(params: Partial<DetectorParams>, storage: KeyValueStorage = localStorage): void {
  storage.setItem(DETECTOR_KEY, JSON.stringify(params))
}

export function clearDetectorParams(storage: KeyValueStorage = localStorage): void {
  storage.removeItem(DETECTOR_KEY)
}

/** Lautsprecher-Modus (Echo-Unterdrückung des Browsers) der Testseite. Ohne gültigen Eintrag: aus. */
export function loadSpeakerMode(storage: KeyValueStorage = localStorage): boolean {
  return read(storage, SPEAKER_MODE_KEY, isBoolean) ?? false
}

export function saveSpeakerMode(on: boolean, storage: KeyValueStorage = localStorage): void {
  storage.setItem(SPEAKER_MODE_KEY, JSON.stringify(on))
}
