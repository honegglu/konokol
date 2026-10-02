import { ArrowLeft, DownloadSimple, Headphones, Microphone, Play, Stop, Timer } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { DetectorParams } from '../../audio/onset/detector'
import { Button } from '../components/Button'
import { DEBUG_PATTERNS } from './debugPatterns'
import { LiveView } from './LiveView'
import { TUNABLE_PARAMS, useAudioLab } from './useAudioLab'

const PARAM_LABELS: Record<(typeof TUNABLE_PARAMS)[number], { label: string; min: number; max: number; step: number }> = {
  riseDb: { label: 'Anstieg (dB)', min: 2, max: 15, step: 0.5 },
  belowPeakDb: { label: 'Einsatz unter Gipfel (dB)', min: 2, max: 15, step: 0.5 },
  aboveFloorDb: { label: 'Über Grundpegel (dB)', min: 4, max: 30, step: 1 },
  minLevelDb: { label: 'Mindestpegel (dBFS)', min: -80, max: -30, step: 1 },
  peakDropDb: { label: 'Gipfel-Abfall (dB)', min: 1, max: 8, step: 0.5 },
  mergeDb: { label: 'Knall auf Vokal umhängen ab (dB)', min: 2, max: 15, step: 0.5 },
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-[0_2px_0_var(--line)]">
      <h2 className="text-lg font-black">{title}</h2>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</span>
      <span className="font-black">{value}</span>
    </div>
  )
}

export function DebugAudioPage() {
  const lab = useAudioLab()
  const { state } = lab
  const [patternId, setPatternId] = useState(DEBUG_PATTERNS[3].id)
  const [bpm, setBpm] = useState(80)
  const [click, setClick] = useState(true)
  const [voice, setVoice] = useState(false)
  const pattern = DEBUG_PATTERNS.find((p) => p.id === patternId) ?? DEBUG_PATTERNS[0]
  const busy = state.mode !== 'idle'

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-muted">
          <ArrowLeft size={16} weight="bold" />
          Zurück
        </Link>
        <h1 className="text-3xl font-black">Audio-Test</h1>
        <p className="max-w-[65ch] text-muted">
          Hier prüfst du Wiedergabe, Mikrofon und die Erkennung deiner Silben. Verwende Kopfhörer, sonst hört das Mikrofon den
          Klick.
        </p>
      </header>

      {state.status !== 'ready' && (
        <Card title="Starten">
          <p className="text-muted">Der Browser fragt nach dem Mikrofon. Erlaube den Zugriff, damit die Erkennung laufen kann.</p>
          {state.error && <p className="rounded-cell bg-error-soft p-3 text-error">{state.error}</p>}
          <div>
            <Button onClick={() => void lab.init()} disabled={state.status === 'starting'} icon={<Microphone size={20} weight="bold" />}>
              {state.status === 'starting' ? 'Startet' : 'Audio starten'}
            </Button>
          </div>
        </Card>
      )}

      {state.status === 'ready' && (
        <>
          <Card title="Status">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Fact label="Abtastrate" value={`${state.sampleRate} Hz`} />
              <Fact label="Ausgabe-Latenz (Browser)" value={`${state.outputLatencyMs} ms`} />
              <Fact label="Mikrofon" value={state.micLabel} />
              <Fact
                label="Kalibrierung"
                value={state.calibration ? `${(state.calibration.latencySeconds * 1000).toFixed(0)} ms` : 'fehlt'}
              />
            </div>
            {state.deviceChanged && (
              <p className="rounded-cell bg-warn-soft p-3">Das Audiogerät hat sich geändert. Bitte neu kalibrieren.</p>
            )}
          </Card>

          <Card title="Kalibrierung">
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={lab.runBleedCheck} disabled={busy} icon={<Headphones size={20} weight="bold" />}>
                Kopfhörer-Check
              </Button>
              <Button variant="ghost" onClick={lab.runLatency} disabled={busy} icon={<Timer size={20} weight="bold" />}>
                Latenz messen
              </Button>
            </div>
            {state.message && <p className="rounded-cell bg-primary-soft p-3">{state.message}</p>}
          </Card>

          <Card title="Testlauf">
            <div className="grid gap-4 md:grid-cols-[2fr_1fr_auto]">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-extrabold text-muted">Pattern</span>
                <select
                  className="rounded-cell border-2 border-line bg-surface p-3 font-extrabold"
                  value={patternId}
                  onChange={(e) => setPatternId(e.target.value)}
                  disabled={busy}
                >
                  {DEBUG_PATTERNS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-extrabold text-muted">Tempo: {bpm} BPM</span>
                <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} disabled={busy} className="accent-primary" />
              </label>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={click} onChange={(e) => setClick(e.target.checked)} disabled={busy} className="accent-primary" />
                  Klick
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} disabled={busy} className="accent-primary" />
                  Stimme
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {state.mode === 'run' ? (
                <Button onClick={lab.stop} icon={<Stop size={20} weight="fill" />}>
                  Stopp
                </Button>
              ) : (
                <Button onClick={() => lab.startRun(pattern, bpm, click, voice)} disabled={busy} icon={<Play size={20} weight="fill" />}>
                  Start
                </Button>
              )}
              <Button variant="ghost" onClick={lab.exportTake} disabled={busy} icon={<DownloadSimple size={20} weight="bold" />}>
                Take exportieren
              </Button>
            </div>
            <LiveView getData={lab.liveData} />
            <p className="text-sm text-muted">
              Oben: Pegel (Petrol), Grundpegel und Schwelle, senkrechte Striche = erkannte Einsätze. Unten: erwartete Silben, Punkt = dein
              Einsatz (Petrol im Ziel, Amber knapp, Koralle verpasst), × = zu viel.
            </p>
          </Card>

          <Card title="Auswertung">
            {state.summary ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <Fact label="Erwartet" value={state.summary.expected} />
                  <Fact label="Erkannt" value={`${state.summary.matched} (${Math.round((state.summary.matched / state.summary.expected) * 100)} %)`} />
                  <Fact label="Zu viel" value={state.summary.extras} />
                  <Fact label="Median Abstand" value={`${state.summary.medianAbsMs.toFixed(1)} ms`} />
                  <Fact label="Median Richtung" value={`${state.summary.medianSignedMs > 0 ? '+' : ''}${state.summary.medianSignedMs.toFixed(1)} ms`} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {state.summary.perSyllable.map((s) => (
                    <span key={s.syl} className="rounded-cell bg-primary-soft px-3 py-2 text-sm">
                      {s.syl}: {s.medianSignedMs > 0 ? '+' : ''}
                      {s.medianSignedMs.toFixed(1)} ms ({s.n})
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted">Positiv = später als das Raster. Grundlage ist die gespeicherte Kalibrierung.</p>
              </div>
            ) : (
              <p className="text-muted">Starte einen Testlauf. Nach jedem vollen Durchgang erscheinen hier die Zahlen.</p>
            )}
          </Card>

          <Card title="Detektor-Einstellungen">
            <div className="grid gap-4 md:grid-cols-2">
              {TUNABLE_PARAMS.map((key) => {
                const meta = PARAM_LABELS[key]
                return (
                  <label key={key} className="flex flex-col gap-2">
                    <span className="text-sm font-extrabold text-muted">
                      {meta.label}: {state.params[key]}
                    </span>
                    <input
                      type="range"
                      min={meta.min}
                      max={meta.max}
                      step={meta.step}
                      value={state.params[key]}
                      onChange={(e) => lab.setParam(key as keyof DetectorParams, Number(e.target.value))}
                      className="accent-primary"
                    />
                  </label>
                )
              })}
            </div>
            <div>
              <Button variant="ghost" onClick={lab.resetParams}>
                Standardwerte
              </Button>
            </div>
          </Card>
        </>
      )}
    </main>
  )
}
