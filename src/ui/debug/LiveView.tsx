import { useEffect, useRef } from 'react'
import type { LiveData } from './useAudioLab'

const WINDOW_SECONDS = 4
const DB_MIN = -80
const DB_MAX = 0

type Palette = { primary: string; muted: string; line: string; warn: string; error: string; text: string }

/** Löst CSS-Variablen (auch light-dark()) in Farben auf, die ein Canvas versteht. */
function readPalette(): Palette {
  const probe = document.createElement('span')
  document.body.appendChild(probe)
  const resolve = (name: string) => {
    probe.style.color = `var(${name})`
    return getComputedStyle(probe).color
  }
  const palette = {
    primary: resolve('--primary'),
    muted: resolve('--text-muted'),
    line: resolve('--line'),
    warn: resolve('--warn'),
    error: resolve('--error'),
    text: resolve('--text'),
  }
  probe.remove()
  return palette
}

/**
 * Oben: Energie (dB) mit Grundpegel, Schwelle und erkannten Einsätzen.
 * Unten: erwartete Silben (um die Latenz verschoben) und ihre Bewertung.
 * Beide Spuren laufen auf der rohen Mikrofon-Zeit, damit Einsätze übereinander stehen.
 */
export function LiveView({ getData }: { getData: () => LiveData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let palette = readPalette()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => {
      palette = readPalette()
    }
    media.addEventListener('change', onScheme)
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) return
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx2d.clearRect(0, 0, width, height)

      const data = getData()
      const t1 = data.now
      const t0 = t1 - WINDOW_SECONDS
      const x = (t: number) => ((t - t0) / WINDOW_SECONDS) * width
      const topH = height * 0.62
      const y = (db: number) => topH - ((Math.min(DB_MAX, Math.max(DB_MIN, db)) - DB_MIN) / (DB_MAX - DB_MIN)) * (topH - 8)

      // Trennlinie und Sekunden-Raster
      ctx2d.strokeStyle = palette.line
      ctx2d.lineWidth = 1
      ctx2d.beginPath()
      ctx2d.moveTo(0, topH + 0.5)
      ctx2d.lineTo(width, topH + 0.5)
      for (let s = Math.ceil(t0); s < t1; s++) {
        ctx2d.moveTo(x(s) + 0.5, 0)
        ctx2d.lineTo(x(s) + 0.5, height)
      }
      ctx2d.stroke()

      const frames = data.frames.filter((f) => f.time >= t0 && f.time <= t1)
      const line = (pick: (f: (typeof frames)[number]) => number, color: string, widthPx: number) => {
        ctx2d.strokeStyle = color
        ctx2d.lineWidth = widthPx
        ctx2d.beginPath()
        frames.forEach((f, i) => (i === 0 ? ctx2d.moveTo(x(f.time), y(pick(f))) : ctx2d.lineTo(x(f.time), y(pick(f)))))
        ctx2d.stroke()
      }
      line((f) => f.floorDb, palette.line, 1.5)
      line((f) => f.floorDb + data.aboveFloorDb, palette.muted, 1)
      line((f) => f.energyDb, palette.primary, 2)

      ctx2d.strokeStyle = palette.text
      ctx2d.lineWidth = 2
      for (const o of data.onsets) {
        if (o.time < t0 || o.time > t1) continue
        ctx2d.beginPath()
        ctx2d.moveTo(x(o.time), 4)
        ctx2d.lineTo(x(o.time), topH)
        ctx2d.stroke()
      }

      // Untere Spur: erwartete Silben und Bewertung
      const midY = topH + (height - topH) / 2
      ctx2d.font = '700 11px Nunito, sans-serif'
      ctx2d.textAlign = 'center'
      for (const m of data.marks) {
        const tx = x(m.t + data.latency)
        if (tx < -20 || tx > width + 20) continue
        const color = m.cls === 'hit' ? palette.primary : m.cls === 'miss' ? palette.error : palette.warn
        ctx2d.fillStyle = color
        ctx2d.fillRect(tx - 1, midY - 12, 2, 24)
        if (m.offset !== null) {
          ctx2d.beginPath()
          ctx2d.arc(x(m.t + m.offset + data.latency), midY, 5, 0, Math.PI * 2)
          ctx2d.fill()
        }
        ctx2d.fillStyle = palette.muted
        ctx2d.fillText(m.syl, tx, midY + 26)
      }
      ctx2d.fillStyle = palette.error
      for (const e of data.extras) {
        const ex = x(e.t + data.latency)
        if (ex < 0 || ex > width) continue
        ctx2d.fillText('×', ex, midY - 16)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      media.removeEventListener('change', onScheme)
    }
  }, [getData])

  return <canvas ref={canvasRef} className="h-64 w-full rounded-cell bg-bg" aria-label="Live-Ansicht von Pegel und erkannten Silben" />
}
