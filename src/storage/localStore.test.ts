import { describe, expect, it } from 'vitest'
import {
  clearDetectorParams,
  loadCalibration,
  loadDetectorParams,
  saveCalibration,
  saveDetectorParams,
  type CalibrationRecord,
  type KeyValueStorage,
} from './localStore'

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const record: CalibrationRecord = {
  latencySeconds: 0.041,
  spreadSeconds: 0.006,
  deviceId: 'abc',
  deviceLabel: 'USB Mikrofon',
  measuredAt: '2026-10-02T20:00:00.000Z',
  headphonesConfirmed: true,
}

describe('localStore', () => {
  it('speichert und lädt die Kalibrierung', () => {
    const storage = memoryStorage()
    expect(loadCalibration(storage)).toBeNull()
    saveCalibration(record, storage)
    expect(loadCalibration(storage)).toEqual(record)
  })

  it('ignoriert kaputte Einträge', () => {
    const storage = memoryStorage()
    storage.setItem('taka:calibration:v1', '{kaputt')
    expect(loadCalibration(storage)).toBeNull()
    storage.setItem('taka:calibration:v1', JSON.stringify({ latencySeconds: 'x' }))
    expect(loadCalibration(storage)).toBeNull()
  })

  it('speichert Detektor-Werte und setzt sie zurück', () => {
    const storage = memoryStorage()
    expect(loadDetectorParams(storage)).toEqual({})
    saveDetectorParams({ riseDb: 5, belowPeakDb: 7 }, storage)
    expect(loadDetectorParams(storage)).toEqual({ riseDb: 5, belowPeakDb: 7 })
    clearDetectorParams(storage)
    expect(loadDetectorParams(storage)).toEqual({})
  })
})
