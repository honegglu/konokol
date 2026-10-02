import { useCallback, useEffect, useRef, useState } from 'react'
import { correctOnsetTime, detectBleed, latencyWarning, measureLatency } from '../../audio/calibration'
import { encodeWav16 } from '../../audio/dsp/wav'
import { AudioEngine, type Playback } from '../../audio/engine'
import { MicError, openMic, type MicInput } from '../../audio/mic'
import { DEFAULT_DETECTOR_PARAMS, minIoiForGrid, type DetectorParams, type FrameStat, type Onset } from '../../audio/onset/detector'
import type { WorkletOutMessage } from '../../audio/onset/messages'
import { Recorder } from '../../audio/recorder'
import { loadSampleBank } from '../../audio/sampleBank'
import { loopStartTime } from '../../audio/timeline'
import { expectedEvents, gridStep, patternDuration } from '../../domain/pattern'
import type { Pattern } from '../../domain/types'
import {
  clearDetectorParams,
  loadCalibration,
  loadDetectorParams,
  saveCalibration,
  saveDetectorParams,
  type CalibrationRecord,
} from '../../storage/localStore'
import { matchNearest, summarize, type DebugSummary, type ExpectedMark, type MatchedMark, type OnsetMark } from './analysis'
import { CALIBRATION_PATTERN } from './debugPatterns'
import { buildTakeFile, download, takeBaseName } from './takeFile'

export type LabMode = 'idle' | 'bleed-check' | 'latency' | 'run'

export type LabState = {
  status: 'idle' | 'starting' | 'ready' | 'error'
  error: string | null
  sampleRate: number | null
  outputLatencyMs: number | null
  micLabel: string | null
  calibration: CalibrationRecord | null
  headphonesOk: boolean | null
  deviceChanged: boolean
  mode: LabMode
  message: string | null
  summary: DebugSummary | null
  params: DetectorParams
}

/** Daten für die Live-Grafik, ohne React-Rendering pro Frame. */
export type LiveData = {
  now: number
  latency: number
  frames: FrameStat[]
  onsets: Onset[]
  marks: MatchedMark[]
  extras: OnsetMark[]
  aboveFloorDb: number
}

const KEEP_FRAMES_SECONDS = 8

/** Werte, die auf der Testseite verstellt und gespeichert werden. */
export const TUNABLE_PARAMS = ['riseDb', 'belowPeakDb', 'aboveFloorDb', 'minLevelDb', 'peakDropDb', 'mergeDb'] as const satisfies readonly (keyof DetectorParams)[]

/** Standardwerte nur der verstellbaren Werte. Alles andere (z. B. `minIoiSeconds`) gehört dem jeweiligen Lauf. */
const TUNABLE_DEFAULTS = Object.fromEntries(TUNABLE_PARAMS.map((k) => [k, DEFAULT_DETECTOR_PARAMS[k]])) as Pick<DetectorParams, (typeof TUNABLE_PARAMS)[number]>

type Run = { pattern: Pattern; bpm: number; playback: Playback }

/**
 * Abgeschlossener Testlauf, eingefroren beim Stopp. Der Export liest nur das, damit WAV und JSON
 * zusammenpassen, egal was danach mit Kalibrierung, Reglern oder Einsatz-Liste passiert.
 */
type RunSnapshot = Run & { onsets: Onset[]; latencySeconds: number; detectorParams: DetectorParams }

/** Schliesst einen AudioContext, auch wenn er schon (oder gerade) geschlossen wird. */
function closeContext(ctx: AudioContext | null): void {
  if (ctx && ctx.state !== 'closed') ctx.close().catch(() => undefined)
}

export function useAudioLab() {
  const [state, setState] = useState<LabState>(() => ({
    status: 'idle',
    error: null,
    sampleRate: null,
    outputLatencyMs: null,
    micLabel: null,
    calibration: loadCalibration(),
    headphonesOk: null,
    deviceChanged: false,
    mode: 'idle',
    message: null,
    summary: null,
    params: { ...DEFAULT_DETECTOR_PARAMS, ...loadDetectorParams() },
  }))
  const patch = useCallback((p: Partial<LabState>) => setState((s) => ({ ...s, ...p })), [])

  const ctxRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const micRef = useRef<MicInput | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const modeRef = useRef<LabMode>('idle')
  const framesRef = useRef<FrameStat[]>([])
  const onsetsRef = useRef<Onset[]>([])
  const marksRef = useRef<MatchedMark[]>([])
  const extrasRef = useRef<OnsetMark[]>([])
  const runRef = useRef<Run | null>(null)
  /** Detektor-Werte, die das Mikrofon im laufenden Testlauf gerade hat (inklusive Raster-Mindestabstand). */
  const runParamsRef = useRef<DetectorParams | null>(null)
  /** Letzter abgeschlossener Lauf, damit nach "Stopp" noch exportiert werden kann. */
  const lastRunRef = useRef<RunSnapshot | null>(null)
  const timersRef = useRef<number[]>([])
  const unmountedRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const setMode = useCallback(
    (mode: LabMode) => {
      modeRef.current = mode
      patch({ mode })
    },
    [patch],
  )

  const latency = () => stateRef.current.calibration?.latencySeconds ?? 0

  const onMicMessage = useCallback((message: WorkletOutMessage) => {
    if (message.type === 'onsets') {
      onsetsRef.current.push(...message.onsets)
      return
    }
    if (modeRef.current === 'run') recorderRef.current?.push(message.startFrame, message.samples)
    const frames = framesRef.current
    frames.push(...message.frames)
    const cutoff = (frames.at(-1)?.time ?? 0) - KEEP_FRAMES_SECONDS
    while (frames.length > 0 && frames[0].time < cutoff) frames.shift()
  }, [])

  const init = useCallback(async () => {
    patch({ status: 'starting', error: null })
    let ctx: AudioContext | null = null
    let mic: MicInput | null = null
    /** Gibt alles frei, was dieser Start angelegt hat (auch bei Abbruch durch Navigation). */
    const release = () => {
      mic?.close()
      closeContext(ctx)
      if (ctxRef.current === ctx) ctxRef.current = null
      if (micRef.current === mic) micRef.current = null
      engineRef.current = null
      recorderRef.current = null
    }
    try {
      ctx = new AudioContext({ latencyHint: 'interactive' })
      // Sofort merken, damit das Aufräumen beim Verlassen der Seite den Context auch während des Ladens findet.
      ctxRef.current = ctx
      await ctx.resume()
      if (unmountedRef.current) return release()
      const bank = await loadSampleBank(ctx)
      if (unmountedRef.current) return release()
      mic = await openMic(ctx, onMicMessage)
      if (unmountedRef.current) return release()
      mic.setParams(stateRef.current.params)
      engineRef.current = new AudioEngine(ctx, bank)
      micRef.current = mic
      recorderRef.current = new Recorder(ctx.sampleRate)
      const calibration = stateRef.current.calibration
      patch({
        status: 'ready',
        sampleRate: ctx.sampleRate,
        outputLatencyMs: Math.round(((ctx.outputLatency || 0) + ctx.baseLatency) * 1000),
        micLabel: mic.label,
        deviceChanged: calibration !== null && calibration.deviceId !== mic.deviceId,
      })
    } catch (error) {
      release()
      if (unmountedRef.current) return
      const message = error instanceof MicError || error instanceof Error ? error.message : String(error)
      patch({ status: 'error', error: message })
    }
  }, [onMicMessage, patch])

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }

  const after = (seconds: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, Math.max(0, seconds) * 1000))
  }

  const stop = useCallback(() => {
    clearTimers()
    engineRef.current?.stop()
    const mic = micRef.current
    const run = runRef.current
    const runParams = runParamsRef.current
    if (modeRef.current === 'run' && run && runParams) {
      // Lauf einfrieren. Die Aufnahme endet jetzt (der Recorder bekommt nur im Modus 'run' Blöcke).
      const recorder = recorderRef.current
      const recordedUntil = (recorder?.startTime ?? 0) + (recorder?.durationSeconds ?? 0)
      const inRecording = () => onsetsRef.current.filter((o) => o.time <= recordedUntil)
      const snapshot: RunSnapshot = { ...run, onsets: inRecording(), latencySeconds: latency(), detectorParams: { ...runParams } }
      lastRunRef.current = snapshot
      // Der letzte zurückgehaltene Einsatz kommt erst nach dem Flush an: nachtragen, soweit er noch in der Aufnahme liegt.
      after(0.2, () => {
        if (lastRunRef.current === snapshot) snapshot.onsets = inRecording()
      })
    }
    mic?.flush()
    runRef.current = null
    runParamsRef.current = null
    setMode('idle')
  }, [setMode])

  /** Spielt Klicks ohne Stimme und wertet danach aus. */
  const runClicks = useCallback(
    (mode: 'bleed-check' | 'latency', bpm: number, countInBars: 0 | 1, minIoi: number, evaluate: (clicks: number[], onsets: number[]) => void) => {
      const engine = engineRef.current
      const mic = micRef.current
      const ctx = ctxRef.current
      if (!engine || !mic || !ctx) return
      clearTimers()
      onsetsRef.current = []
      // Die Kalibrierung ersetzt die Einsätze, also darf auch kein früherer Lauf mehr exportierbar sein.
      recorderRef.current?.clear()
      lastRunRef.current = null
      mic.reset({ ...stateRef.current.params, minIoiSeconds: minIoi })
      setMode(mode)
      const playback = engine.start({ pattern: CALIBRATION_PATTERN, bpm, countInBars, loops: 2, click: true, voice: false })
      const beat = 60 / bpm
      const clicks = Array.from({ length: 8 }, (_, i) => playback.firstLoopTime + i * beat)
      after((playback.endTime ?? 0) - ctx.currentTime + 0.6, () => {
        mic.flush()
        after(0.1, () => {
          evaluate(clicks, onsetsRef.current.map((o) => o.time))
          setMode('idle')
        })
      })
    },
    [setMode],
  )

  const runBleedCheck = useCallback(() => {
    patch({ message: 'Bleib still. Es laufen 8 Klicks.' })
    runClicks('bleed-check', 100, 0, 0.2, (clicks, onsets) => {
      const result = detectBleed(clicks, onsets)
      patch({
        headphonesOk: !result.bleed,
        message: result.bleed
          ? `Das Mikrofon hört den Klick (${result.hits} von ${result.total}). Bitte Kopfhörer verwenden.`
          : `Kopfhörer-Check bestanden (${result.hits} von ${result.total} Klicks gehört).`,
      })
    })
  }, [patch, runClicks])

  const runLatency = useCallback(() => {
    patch({ message: 'Nach dem Einzählen: sprich auf jeden der 8 Klicks ein deutliches "Ta".' })
    runClicks('latency', 60, 1, 0.3, (clicks, onsets) => {
      const result = measureLatency(clicks, onsets)
      const mic = micRef.current
      if (!result.ok) {
        patch({
          message:
            result.reason === 'zu-wenige'
              ? `Nur ${result.matched} von 8 Silben erkannt. Sprich auf jeden Klick ein deutliches "Ta".`
              : `Zu unruhig (Streuung ${(result.spreadSeconds * 1000).toFixed(0)} ms). Versuche es etwas gleichmässiger.`,
        })
        return
      }
      const record: CalibrationRecord = {
        latencySeconds: result.latencySeconds,
        spreadSeconds: result.spreadSeconds,
        deviceId: mic?.deviceId ?? '',
        deviceLabel: mic?.label ?? '',
        measuredAt: new Date().toISOString(),
        headphonesConfirmed: stateRef.current.headphonesOk === true,
      }
      saveCalibration(record)
      const warning = latencyWarning(result.latencySeconds)
        ? ' Das ist viel. Vermutlich ein Bluetooth-Kopfhörer: Mit Kabel wird es genauer.'
        : ''
      patch({
        calibration: record,
        deviceChanged: false,
        message: `Latenz ${(result.latencySeconds * 1000).toFixed(0)} ms, Streuung ${(result.spreadSeconds * 1000).toFixed(0)} ms. Gespeichert.${warning}`,
      })
    })
  }, [patch, runClicks])

  const analyze = useCallback(() => {
    const run = runRef.current
    const ctx = ctxRef.current
    if (!run || !ctx) return
    const { pattern, bpm, playback } = run
    const loopDur = patternDuration(pattern, bpm)
    const done = Math.floor((ctx.currentTime - playback.firstLoopTime) / loopDur)
    const expected: ExpectedMark[] = []
    for (let loop = 0; loop < done; loop++) {
      for (const e of expectedEvents(pattern, bpm, loopStartTime(playback.options, loop))) {
        expected.push({ t: e.t, syl: e.syl, accent: e.accent, loop })
      }
    }
    const lat = latency()
    const onsets = onsetsRef.current.map((o) => ({ t: correctOnsetTime(o.time, lat), peakDb: o.peakDb }))
    const until = playback.firstLoopTime + done * loopDur
    const { marks, extras } = matchNearest(expected, onsets.filter((o) => o.t < until), gridStep(pattern, bpm))
    marksRef.current = marks
    extrasRef.current = extras
    patch({ summary: marks.length > 0 ? summarize(marks, extras.length) : null })
  }, [patch])

  const startRun = useCallback(
    (pattern: Pattern, bpm: number, click: boolean, voice: boolean) => {
      const engine = engineRef.current
      const mic = micRef.current
      if (!engine || !mic) return
      clearTimers()
      onsetsRef.current = []
      marksRef.current = []
      extrasRef.current = []
      recorderRef.current?.clear()
      lastRunRef.current = null
      const runParams: DetectorParams = { ...stateRef.current.params, minIoiSeconds: minIoiForGrid(gridStep(pattern, bpm)) }
      mic.reset(runParams)
      const playback = engine.start({ pattern, bpm, countInBars: 1, loops: null, click, voice })
      runRef.current = { pattern, bpm, playback }
      runParamsRef.current = runParams
      setMode('run')
      patch({ summary: null, message: null })
      const tick = () => {
        if (modeRef.current !== 'run') return
        analyze()
        after(0.25, tick)
      }
      after(0.25, tick)
    },
    [analyze, patch, setMode],
  )

  const setParam = useCallback(
    (key: keyof DetectorParams, value: number) => {
      const params = { ...stateRef.current.params, [key]: value }
      saveDetectorParams(Object.fromEntries(TUNABLE_PARAMS.map((k) => [k, params[k]])))
      micRef.current?.setParams({ [key]: value })
      if (runParamsRef.current) runParamsRef.current = { ...runParamsRef.current, [key]: value }
      patch({ params })
    },
    [patch],
  )

  const resetParams = useCallback(() => {
    clearDetectorParams()
    // Nur die verstellbaren Werte, sonst würde ein laufender Test seinen Raster-Mindestabstand verlieren.
    micRef.current?.setParams(TUNABLE_DEFAULTS)
    if (runParamsRef.current) runParamsRef.current = { ...runParamsRef.current, ...TUNABLE_DEFAULTS }
    patch({ params: { ...stateRef.current.params, ...TUNABLE_DEFAULTS } })
  }, [patch])

  const exportTake = useCallback(() => {
    const recorder = recorderRef.current
    const ctx = ctxRef.current
    const source = lastRunRef.current
    const start = recorder?.startTime
    if (modeRef.current !== 'idle' || !source || !recorder || !ctx || start === null || start === undefined || recorder.durationSeconds < 1) {
      patch({ message: 'Noch keine Aufnahme. Starte zuerst einen Testlauf mit Mikrofon.' })
      return
    }
    const { pattern, bpm, playback } = source
    const end = start + recorder.durationSeconds
    const loopDur = patternDuration(pattern, bpm)
    const loops = Math.max(0, Math.floor((end - playback.firstLoopTime) / loopDur))
    const expected = Array.from({ length: loops }, (_, loop) =>
      expectedEvents(pattern, bpm, loopStartTime(playback.options, loop)).map((e) => ({ t: e.t, syl: e.syl, accent: e.accent })),
    ).flat()
    const take = buildTakeFile({
      patternId: pattern.id,
      bpm,
      sampleRate: ctx.sampleRate,
      recordingStartTime: start,
      latencySeconds: source.latencySeconds,
      detectorParams: source.detectorParams,
      expected,
      onsets: source.onsets,
    })
    const name = takeBaseName(pattern.id, bpm, new Date())
    download(`${name}.wav`, encodeWav16(recorder.toFloat32(), ctx.sampleRate), 'audio/wav')
    download(`${name}.json`, JSON.stringify(take, null, 2), 'application/json')
    patch({ message: `Exportiert: ${name}.wav und .json. Lege beide in tests/fixtures/takes/ ab.` })
  }, [patch])

  const liveData = useCallback(
    (): LiveData => ({
      now: engineRef.current?.audibleTime() ?? 0,
      latency: latency(),
      frames: framesRef.current,
      onsets: onsetsRef.current,
      marks: marksRef.current,
      extras: extrasRef.current,
      aboveFloorDb: stateRef.current.params.aboveFloorDb,
    }),
    [],
  )

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && modeRef.current !== 'idle') {
        stop()
        patch({ message: 'Abgebrochen, weil der Tab im Hintergrund war. Das Timing wäre sonst unzuverlässig.' })
      }
    }
    const onDeviceChange = () => patch({ deviceChanged: true })
    document.addEventListener('visibilitychange', onVisibility)
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
    }
  }, [patch, stop])

  useEffect(() => {
    // Zurücksetzen, weil React im Entwicklungsmodus (StrictMode) Aufräumen und Einrichten einmal vorab durchspielt.
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      clearTimers()
      engineRef.current?.stop()
      micRef.current?.close()
      closeContext(ctxRef.current)
      ctxRef.current = null
      micRef.current = null
      engineRef.current = null
    }
  }, [])

  return { state, init, stop, runBleedCheck, runLatency, startRun, setParam, resetParams, exportTake, liveData }
}
