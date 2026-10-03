import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { decodeWav } from '../../src/audio/dsp/wav'
import { detectOnsets } from '../../src/audio/onset/detector'

/**
 * Die Audio-Testseite im echten Browser. Es geht um Aufräumen und Export-Konsistenz, nicht um die
 * Erkennungsqualität.
 *
 * Das Mikrofon ist ein künstlicher Stream (Piepton im Halbsekundentakt aus einem eigenen AudioContext).
 * Chromiums eigenes Test-Mikrofon (`--use-fake-device-for-media-stream`) bleibt in diesem Headless-Chromium
 * auf macOS bei `getUserMedia({ audio })` ohne Antwort hängen (Video geht), deshalb taugt es hier nicht.
 */
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })

type Probe = {
  __contexts: AudioContext[]
  __streams: MediaStream[]
  __releaseMic?: () => void
}

/**
 * Zeichnet jeden AudioContext der Seite und jeden Mikrofon-Stream auf, damit der Test prüfen kann, was
 * freigegeben wurde. Der Hilfs-Context des künstlichen Mikrofons zählt nicht mit.
 * - 'tone': getUserMedia liefert den künstlichen Stream
 * - 'denied': getUserMedia lehnt wie bei verweigerter Erlaubnis ab
 * - 'held': wie 'tone', aber erst, wenn der Test `__releaseMic()` aufruft
 */
async function instrument(page: Page, mic: 'tone' | 'denied' | 'held') {
  await page.addInitScript((mode) => {
    const probe = window as unknown as Probe
    probe.__contexts = []
    probe.__streams = []
    const Native = window.AudioContext
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options)
        probe.__contexts.push(this)
      }
    }
    const tone = () => {
      const source = new Native()
      const gain = source.createGain()
      gain.gain.value = 0
      const oscillator = source.createOscillator()
      const destination = source.createMediaStreamDestination()
      oscillator.connect(gain).connect(destination)
      oscillator.start()
      for (let i = 0; i < 240; i++) {
        const t = source.currentTime + i * 0.5
        gain.gain.setValueAtTime(0.5, t)
        gain.gain.setTargetAtTime(0, t + 0.02, 0.04)
      }
      void source.resume()
      probe.__streams.push(destination.stream)
      return destination.stream
    }
    const devices = navigator.mediaDevices
    if (mode === 'denied') {
      devices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
    } else if (mode === 'held') {
      devices.getUserMedia = () =>
        new Promise<MediaStream>((resolve) => {
          probe.__releaseMic = () => resolve(tone())
        })
    } else {
      devices.getUserMedia = async () => tone()
    }
  }, mic)
}

const contextStates = (page: Page) => page.evaluate(() => (window as unknown as Probe).__contexts.map((c) => c.state))
const trackStates = (page: Page) =>
  page.evaluate(() => (window as unknown as Probe).__streams.flatMap((s) => s.getTracks().map((t) => t.readyState)))

async function startAudio(page: Page) {
  await page.goto('/debug/audio')
  await page.getByRole('button', { name: 'Audio starten' }).click()
  await expect(page.getByRole('heading', { name: 'Status', exact: true })).toBeVisible()
}

const exportButton = (page: Page) => page.getByRole('button', { name: 'Take exportieren' })
const startButton = (page: Page) => page.getByRole('button', { name: 'Start', exact: true })

async function setBpm(page: Page, bpm: number) {
  await page.getByRole('slider').first().fill(String(bpm))
  await expect(page.getByText(`Tempo: ${bpm} BPM`)).toBeVisible()
}

test('verweigertes Mikrofon: deutsche Meldung, und jeder AudioContext wird wieder geschlossen', async ({ page }) => {
  await instrument(page, 'denied')
  await page.goto('/debug/audio')

  const start = page.getByRole('button', { name: 'Audio starten' })
  await start.click()
  await expect(page.getByText('Der Mikrofon-Zugriff wurde verweigert.')).toBeVisible()
  await expect.poll(() => contextStates(page)).toEqual(['closed'])

  // Jeder neue Versuch legt einen Context an, aber keiner darf offen bleiben.
  await start.click()
  await expect(page.getByText('Der Mikrofon-Zugriff wurde verweigert.')).toBeVisible()
  await expect.poll(() => contextStates(page)).toEqual(['closed', 'closed'])
})

test('Seite verlassen, während das Mikrofon noch gefragt wird: nichts bleibt offen', async ({ page }) => {
  await instrument(page, 'held')
  await page.goto('/debug/audio')
  await page.getByRole('button', { name: 'Audio starten' }).click()
  await page.waitForFunction(() => typeof (window as unknown as Probe).__releaseMic === 'function')

  // Client-seitig zur Startseite (die Seite lebt weiter), dann beantwortet der Nutzer die Abfrage doch noch.
  await page.getByRole('link', { name: 'Zurück' }).click()
  await expect(page.getByRole('link', { name: 'Audio testen' })).toBeVisible()
  await page.evaluate(() => (window as unknown as Probe).__releaseMic?.())

  await expect.poll(() => page.evaluate(() => (window as unknown as Probe).__streams.length), { timeout: 5000 }).toBe(1)
  await expect.poll(() => trackStates(page), { timeout: 5000 }).toEqual(['ended'])
  await expect.poll(() => contextStates(page), { timeout: 5000 }).toEqual(['closed'])
})

test('Export gehört zum letzten Lauf: nach dem Kopfhörer-Check gibt es keine Aufnahme mehr', async ({ page }) => {
  await instrument(page, 'tone')
  const downloads: string[] = []
  page.on('download', (d) => downloads.push(d.suggestedFilename()))
  await startAudio(page)
  await setBpm(page, 120)

  await startButton(page).click()
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Stopp' }).click()

  await page.getByRole('button', { name: 'Kopfhörer-Check' }).click()
  await expect(page.getByText(/Kopfhörer-Check bestanden|Das Mikrofon hört den Klick/)).toBeVisible({ timeout: 15_000 })

  await exportButton(page).click()
  await expect(page.getByText('Noch keine Aufnahme.')).toBeVisible()
  expect(downloads).toEqual([])
})

test('Export ist gesperrt, solange eine Messung läuft', async ({ page }) => {
  await instrument(page, 'tone')
  await startAudio(page)

  await expect(exportButton(page)).toBeEnabled()
  await page.getByRole('button', { name: 'Kopfhörer-Check' }).click()
  await expect(page.getByText('Bleib still. Es laufen 8 Klicks.')).toBeVisible()
  await expect(exportButton(page)).toBeDisabled()
})

test('Export eines Laufs schreibt WAV und JSON mit den Werten des Laufs', async ({ page }) => {
  await instrument(page, 'tone')
  const downloads: { name: string; body: Buffer }[] = []
  page.on('download', async (d) => {
    const path = await d.path()
    downloads.push({ name: d.suggestedFilename(), body: await readFile(path) })
  })
  await startAudio(page)
  await setBpm(page, 120)

  await startButton(page).click()
  await page.waitForTimeout(5500)
  // Ein Regler-Reset mitten im Lauf darf den Raster-Mindestabstand des Laufs nicht ändern.
  await page.getByRole('button', { name: 'Standardwerte' }).click()
  await page.getByRole('button', { name: 'Stopp' }).click()
  await exportButton(page).click()

  await expect(page.getByText(/^Exportiert: take-takadimi-120bpm-/)).toBeVisible()
  await expect.poll(() => downloads.length).toBe(2)
  const wav = downloads.find((d) => d.name.endsWith('.wav'))
  const json = downloads.find((d) => d.name.endsWith('.json'))
  if (!wav || !json) throw new Error('WAV oder JSON wurde nicht heruntergeladen')
  expect(wav.body.subarray(0, 4).toString('ascii')).toBe('RIFF')
  const take = JSON.parse(json.body.toString('utf8'))
  expect(take).toMatchObject({ version: 1, patternId: 'takadimi', bpm: 120, latencySeconds: 0 })
  // Ta-ka-di-mi bei 120 BPM: Schritt 0,125 s, Mindestabstand 0,6 mal Schritt.
  expect(take.detectorParams.minIoiSeconds).toBeCloseTo(0.075)
  expect(take.expected.length).toBeGreaterThanOrEqual(16)

  // Positivkontrolle der Zeitbasis: Dieselben Einsätze, offline aus der WAV-Datei berechnet, müssen an den live
  // erkannten Stellen liegen. Das stimmt nur, wenn `recordingStartTime` (Beginn der Aufnahme) wirklich passt.
  const { samples, sampleRate } = decodeWav(new Uint8Array(wav.body))
  expect(sampleRate).toBe(take.sampleRate)
  const offline = detectOnsets(samples, sampleRate, take.detectorParams).map((o) => o.time)
  const live: number[] = take.onsets.map((o: { t: number }) => o.t)
  // Der Piepton kommt alle 0,5 s, in 5,5 s Aufnahme also gut ein Dutzend Mal.
  expect(live.length).toBeGreaterThanOrEqual(8)
  const found = live.filter((t) => offline.some((o) => Math.abs(o - t) <= 0.02)).length
  expect(found / live.length).toBeGreaterThanOrEqual(0.9)
})

test('Export wird verweigert, wenn während des Laufs ein Regler verstellt wurde', async ({ page }) => {
  await instrument(page, 'tone')
  const downloads: string[] = []
  page.on('download', (d) => downloads.push(d.suggestedFilename()))
  await startAudio(page)
  await setBpm(page, 120)

  await startButton(page).click()
  await page.waitForTimeout(3000)
  // Live verstellen bleibt erlaubt, aber der Take würde dann falsche Detektor-Werte angeben.
  await page.getByRole('slider', { name: /Anstieg/ }).fill('9')
  await expect(page.getByText('Anstieg (dB): 9')).toBeVisible()
  await page.getByRole('button', { name: 'Stopp' }).click()
  await exportButton(page).click()

  await expect(page.getByText('Regler wurden während des Laufs verstellt. Bitte einen neuen Lauf aufnehmen.')).toBeVisible()
  expect(downloads).toEqual([])
})
