# Plan 1: Gerüst und Audio-Kern (taka, Konnakol-Trainer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lauffähiges Projekt (Vite, React, TypeScript, Docker) mit generierten ElevenLabs-Sounds, sample-genauer Wiedergabe, Mikrofon-Einsatz-Erkennung im AudioWorklet, Latenz-Kalibrierung und einer Debug-Ansicht, in der Luca die Erkennung mit seiner Stimme abnimmt.

**Architecture:** Rein clientseitige SPA. Reine Logik (`src/domain`, Detektor, Zeitplan) ist ohne Browser testbar; der Browser-Teil (Engine, Mikrofon, Worklet) ist dünn und durch einen Playwright-Test abgesichert. Sounds erzeugt ein Node-Skript einmalig, sie liegen fertig im Repo. nginx im Container liefert alles aus.

**Tech Stack:** Node 22, Vite 8, React 19, TypeScript 6, Tailwind CSS 4, React Router 8, Phosphor Icons, Vitest 5, Playwright 1.63, tsx, nginx (alpine), ElevenLabs API.

**Spec:** [`docs/superpowers/specs/2026-10-02-konnakol-trainer-design.md`](../specs/2026-10-02-konnakol-trainer-design.md) (Abschnitte 7, 8.1, 9, 10, 12, 13 Phase 1 und 2)

## Fahrplan

Die Spec hat sechs Bauphasen. Nach Phase 2 nimmt Luca die Einsatz-Erkennung mit seiner Stimme ab; das Ergebnis (Detektor-Werte, eventuelle Silben-Offsets) fliesst in alles Weitere ein. Deshalb gibt es mehrere Pläne:

| Plan | Inhalt | Status |
|---|---|---|
| **Plan 1 (dieses Dokument)** | Phase 1 Gerüst, Docker, Sounds; Phase 2 Audio-Kern, Kalibrierung, Debug-Ansicht, Abnahme | bereit |
| Plan 2 | Phase 3: Bewertung (DP-Zuordnung, Score, Akzente, Tendenz), vier Übungstypen, Auswertung, Raster linear/zyklisch, Notenschrift | nach Abnahme |
| Plan 3 | Phase 4 und 5: Startseite, Lektionsablauf, Spielmechanik, Speicherstand (`ProgressStore`), Inhalte Unit 1 bis 4 | nach Plan 2 |
| Plan 4 | Phase 6: Freies Üben, Schwachstellen, Einstellungen, Export/Import, E2E-Tests | nach Plan 3 |

## Abweichungen und Präzisierungen gegenüber der Spec

Beim Prototyping (Python-Prototyp mit echten ElevenLabs-Silben, danach dieser Code im Scratchpad: 83 Unit-Tests, Browser-Test, Docker) sind folgende Punkte präzisiert worden. Die Spec ist bereits angepasst.

1. **Einsatzpunkt = Vokalbeginn.** Der Detektor erkennt den Anstieg zum Vokal, nicht den Konsonanten-Knall (der geht bei flüssigem Sprechen unter). Derselbe Detektor misst `refSeconds` jedes Samples. Silben-Offsets bei der Erkennung sind standardmässig 0.
2. **Mindestabstand** zwischen Einsätzen `max(40 ms, 0.6 · s)` statt `0.5 · s`.
3. **Samples** enden bei Einsatzpunkt + 130 ms (statt max. 350 ms). Format WAV 24 kHz aus `pcm_24000`.
4. **Worklet:** Quanten ohne aktiven Eingang werden als Stille verarbeitet (sonst verrutscht die Zeitbasis; im Prototyp gemessen: konstant −10 ms).
5. **Playwright** kommt schon in Plan 1 (Browser-Integrationstest für Engine und Worklet).
6. **Zwischenspeicher:** Kalibrierung und Detektor-Werte liegen bis Plan 3 unter eigenen localStorage-Schlüsseln (`taka:calibration:v1`, `taka:detector:v1`) und wandern dann in den versionierten Speicherstand.
7. **Debug-Ansicht** zeigt statt der rohen Wellenform die Energiekurve, auf der der Detektor arbeitet (mit Grundpegel und Schwelle). Das ist für die Abnahme aussagekräftiger. Detektor-Werte lassen sich dort per Schieberegler anpassen.
8. **Kopfhörer-Check:** In Plan 1 meldet die Debug-Ansicht das Ergebnis nur. Die explizite Bestätigung "trotzdem fortfahren" vor Lektionen (Spec 7.5) folgt mit dem Lektionsablauf in Plan 3.

## Global Constraints

- Node 22, npm. Paketversionen wie in Task 1 angegeben (Vite `^8.3`, React `^19.2`, TypeScript `~6.0.2`, Tailwind `^4.3`, Vitest `^5.0`).
- TypeScript strikt mit `erasableSyntaxOnly` (keine Enums, keine Namespaces, keine Parameter-Properties) und `verbatimModuleSyntax` (`import type` für reine Typen).
- Texte in der UI: Deutsch, Schweizer Schreibweise (ss, kein ß), keine Gedankenstriche (— oder –) als Gestaltungsmittel.
- Farben nur über die Tokens aus `src/styles/index.css` (Spec 8.1). Icons nur aus `@phosphor-icons/react`. Keine Emojis in der UI.
- Der ElevenLabs-Key heisst `ELEVENLABS_API`. Er wird nur in `tools/` gelesen, nie im Browser-Code. `.env` wird nie committet.
- Audio-Assets: WAV, 16 Bit, mono, 24 kHz. Zeiten im Code immer in Sekunden auf der Uhr des `AudioContext`.
- Jeder Task endet mit Commit und `git push` auf `main` (Repo `https://github.com/honegglu/konokol`). Commit-Nachrichten enden mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Kommentare im Code auf Deutsch, knapp, nur wo sie etwas erklären, das der Code nicht selbst sagt.

## Dateistruktur nach Plan 1

```
Dockerfile, docker-compose.yml, nginx.conf, .dockerignore
index.html, package.json, vite.config.ts, playwright.config.ts
tsconfig.json, tsconfig.app.json, tsconfig.node.json, tsconfig.tools.json
public/sounds/                 generierte WAVs + manifest.json (committet)
src/
  main.tsx
  styles/index.css             Design-Tokens (hell/dunkel)
  domain/                      reine Logik
    types.ts                   SyllableId, Cell, Beat, Pattern, ExpectedEvent
    pattern.ts                 expectedEvents, validatePattern, gridStep, ...
    windows.ts                 Zeitfenster und Klassen (Spec 5.1)
    stats.ts                   median
  content/syllables.ts         Silbenwörter, wordBeat, groupedBeats
  audio/
    dsp/wav.ts, dsp/level.ts   WAV lesen/schreiben, Pegel
    manifest.ts                Typen des Sound-Manifests
    timeline.ts                Ereignisse eines Durchlaufs (rein)
    scheduler.ts               Lookahead-Scheduler
    sampleBank.ts              lädt und dekodiert Sounds
    engine.ts                  Wiedergabe (Klick, Einzählen, Silben)
    onset/detector.ts          Einsatz-Erkennung (rein)
    onset/testSignals.ts       synthetische Testsignale (nur Tests)
    onset/messages.ts          Nachrichten Worklet <-> Seite
    onset/onset-worklet.ts     AudioWorkletProcessor
    onset/worklet-env.d.ts     Typen des Worklet-Scopes
    mic.ts                     Mikrofon + Worklet anschliessen
    recorder.ts                Aufnahme zusammensetzen
    calibration.ts             Kopfhörer-Check, Latenz (rein)
  storage/localStore.ts        Kalibrierung, Detektor-Werte
  ui/
    App.tsx, components/Button.tsx, pages/HomePage.tsx
    debug/                     Audio-Testseite
tools/
  generate-sounds.ts, sounds.config.json
  lib/analyze.ts, lib/elevenlabs.ts, lib/takes.ts
tests/
  e2e/engine.spec.ts, e2e/worklet.spec.ts
  fixtures/takes/              echte Aufnahmen von Luca (Abnahme)
```

---

### Task 1: Projekt-Gerüst mit Design-Tokens

**Files:**
- Create: `package.json`, `package-lock.json` (durch npm), `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `src/main.tsx`, `src/styles/index.css`, `src/ui/App.tsx`, `src/ui/components/Button.tsx`, `src/ui/pages/HomePage.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `buttonClass(variant?: 'primary' | 'ghost', extra?: string): string`, `<Button variant icon>`, Tailwind-Farben `primary`, `primary-edge`, `primary-soft`, `on-primary`, `bg`, `surface`, `text`, `muted`, `warn`, `warn-soft`, `error`, `error-soft`, `line`, Radien `rounded-card` (14 px), `rounded-cell` (9 px). Route `/` mit `HomePage`.

- [ ] **Step 1: `package.json` anlegen**

```json
{
  "name": "taka",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "sounds": "tsx tools/generate-sounds.ts"
  }
}
```

- [ ] **Step 2: Abhängigkeiten installieren**

```bash
npm install --no-audit --no-fund react@^19.2 react-dom@^19.2 react-router@^8.4 @phosphor-icons/react@^2.1 @fontsource/nunito@^5.3
npm install --no-audit --no-fund -D vite@^8.3 @vitejs/plugin-react@^6.1 typescript@~6.0.2 @types/react@^19.2 @types/react-dom@^19.2 @types/node@^24 tailwindcss@^4.3 @tailwindcss/vite@^4.3 vitest@^5.0 tsx@^4.23
```

Expected: `package.json` enthält die Pakete unter `dependencies` bzw. `devDependencies`, `package-lock.json` existiert.

- [ ] **Step 3: TypeScript-Konfiguration**

`tsconfig.json` (Task 3 ergänzt die Referenz auf `tsconfig.tools.json`):

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Vite-Konfiguration (inkl. Vitest) und `index.html`**

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="de-CH">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0e6e74" />
    <meta name="description" content="Konnakol lernen: Rhythmen sprechen mit Mikrofon-Feedback." />
    <title>taka</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Design-Tokens, Einstieg, Button, Startseite**

`src/styles/index.css`:

```css
@import "tailwindcss";

/* Design-Tokens "Tiefes Petrol" (Spec 8.1). light-dark() wählt je nach color-scheme. */
:root {
  color-scheme: light dark;
  --primary: light-dark(#0e6e74, #1fa3a3);
  --primary-edge: light-dark(#08494d, #127070);
  --primary-soft: light-dark(#e1f0f0, #172a2e);
  --on-primary: light-dark(#ffffff, #0f1d20);
  --bg: light-dark(#eef6f6, #0f1d20);
  --surface: light-dark(#ffffff, #172a2e);
  --text: light-dark(#2f3a3c, #e3eeee);
  --text-muted: light-dark(#5c6b6e, #8fa3a5);
  --warn: light-dark(#e39a2d, #f0aa45);
  --warn-soft: light-dark(#fcebcb, #3a3020);
  --error: light-dark(#e2604a, #e8705e);
  --error-soft: light-dark(#fbe1dc, #3d2422);
  --line: light-dark(#dce6e6, #22363a);
}

:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}

@theme inline {
  --color-primary: var(--primary);
  --color-primary-edge: var(--primary-edge);
  --color-primary-soft: var(--primary-soft);
  --color-on-primary: var(--on-primary);
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-warn: var(--warn);
  --color-warn-soft: var(--warn-soft);
  --color-error: var(--error);
  --color-error-soft: var(--error-soft);
  --color-line: var(--line);
  --font-sans: "Nunito", ui-sans-serif, system-ui, sans-serif;
  --radius-card: 14px;
  --radius-cell: 9px;
}

@layer base {
  html {
    font-family: var(--font-sans);
    font-weight: 700;
  }

  body {
    background: var(--bg);
    color: var(--text);
  }

  :focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
}
```

`src/main.tsx`:

```tsx
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './ui/App'

const root = document.getElementById('root')
if (!root) throw new Error('#root fehlt in index.html')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

`src/ui/App.tsx` (Task 11 ergänzt die Route `/debug/audio`):

```tsx
import { Route, Routes } from 'react-router'
import { HomePage } from './pages/HomePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
```

`src/ui/components/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'ghost'

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card px-4 py-3 text-sm font-black uppercase tracking-wide transition-transform duration-300 active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-[0_4px_0_var(--primary-edge)] active:shadow-[0_2px_0_var(--primary-edge)]',
  ghost:
    'bg-surface text-muted shadow-[inset_0_0_0_2px_var(--line),0_4px_0_var(--line)] active:shadow-[inset_0_0_0_2px_var(--line),0_2px_0_var(--line)]',
}

/** Klassen eines 3D-Buttons, auch für Links verwendbar. */
export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim()
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }

export function Button({ variant = 'primary', icon, className = '', children, ...rest }: Props) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}
```

`src/ui/pages/HomePage.tsx`:

```tsx
import { Waveform } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { buttonClass } from '../components/Button'

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-3xl font-black tracking-wide text-primary">taka</p>
      <h1 className="text-3xl font-black leading-tight">Konnakol lernen, Silbe für Silbe.</h1>
      <p className="max-w-[60ch] text-lg text-muted">
        Der Lernpfad entsteht in einer späteren Phase. Im Moment gibt es die Audio-Testseite: Dort prüfst du Wiedergabe,
        Mikrofon und die Erkennung deiner Silben.
      </p>
      <div>
        <Link to="/debug/audio" className={buttonClass('primary')}>
          <Waveform size={20} weight="bold" />
          Audio testen
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 6: `.gitignore` ergänzen**

Am Ende von `.gitignore` anfügen:

```
# Hörproben und einzelne Takes des Sound-Skripts
tools/.audition/
```

- [ ] **Step 7: Bauen und Tests laufen lassen**

Run: `npm run build && npm test`
Expected: `tsc -b` ohne Fehler, `vite build` endet mit `✓ built`, Vitest meldet `No test files found, exiting with code 0`.

- [ ] **Step 8: Sichtprüfung**

Run: `npm run dev` und `http://localhost:5173` öffnen.
Expected: "taka" in Petrol, Überschrift "Konnakol lernen, Silbe für Silbe.", Button "Audio testen" mit 3D-Unterkante, Schrift Nunito. Bei dunklem System-Theme: dunkler Petrol-Grund (`#0f1d20`). Der Button führt vorerst wieder zur Startseite (Route folgt in Task 11).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json src .gitignore
git commit -m "feat: Projekt-Gerüst mit Vite, React, Tailwind und Petrol-Tokens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Docker-Container mit nginx

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `.dockerignore`, `docker-compose.yml`

**Interfaces:**
- Produces: `docker compose up --build` liefert die App unter `http://localhost:8080`. Service `sounds` folgt in Task 6.

- [ ] **Step 1: Dateien anlegen**

`Dockerfile`:

```dockerfile
# Stufe 1: App bauen
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Stufe 2: Statische Dateien mit nginx ausliefern
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Gebaute Dateien haben einen Hash im Namen und ändern sich nie.
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # Sounds: WAV ist nicht in den nginx-Standardtypen enthalten.
  location /sounds/ {
    types {
      audio/wav wav;
      application/json json;
    }
    add_header Cache-Control "public, max-age=3600";
    try_files $uri =404;
  }

  # Single-Page-App: alle übrigen Pfade liefern index.html.
  location / {
    add_header Cache-Control "no-cache";
    try_files $uri $uri/ /index.html;
  }
}
```

`.dockerignore`:

```text
node_modules
dist
coverage
playwright-report
test-results
.git
.env
.env.*
!.env.example
.superpowers
tools/.audition
```

`docker-compose.yml` (vorerst nur `app`):

```yaml
services:
  app:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

- [ ] **Step 2: Container bauen und prüfen**

Run:

```bash
docker compose up --build -d
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" localhost:8080/
curl -s localhost:8080/irgendein/pfad | grep -o '<div id="root"></div>'
docker compose down
```

Expected: `200 text/html` und `<div id="root"></div>` (SPA-Fallback).

- [ ] **Step 3: Commit**

```bash
git add Dockerfile nginx.conf .dockerignore docker-compose.yml
git commit -m "feat: Docker-Container mit nginx und SPA-Fallback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Rhythmus-Domäne (Patterns, Zeitpunkte, Zeitfenster)

**Files:**
- Create: `src/domain/types.ts`, `src/domain/pattern.ts`, `src/domain/stats.ts`, `src/domain/windows.ts`, `src/content/syllables.ts`
- Test: `src/domain/pattern.test.ts`, `src/domain/windows.test.ts`
- Create: `tsconfig.tools.json`; Modify: `tsconfig.json`

**Interfaces:**
- Produces:
  - Typen `SyllableId`, `Division`, `Cell`, `Beat`, `Pattern`, `ExpectedEvent` (`src/domain/types.ts`)
  - `beatDuration(bpm)`, `cellCount(pattern)`, `patternDuration(pattern, bpm)`, `gridStep(pattern, bpm)`, `validatePattern(pattern): string[]`, `expectedEvents(pattern, bpm, offset = 0): ExpectedEvent[]` (`src/domain/pattern.ts`)
  - `median(values: number[]): number` (`src/domain/stats.ts`)
  - `type Tolerance = 'locker' | 'normal' | 'streng'`, `timingWindows(step, tolerance = 'normal'): { tight, loose }`, `type TimingClass = 'hit' | 'early' | 'late' | 'miss'`, `classifyOffset(offset | null, windows): TimingClass` (`src/domain/windows.ts`)
  - `SYLLABLES`, `WORDS: Record<Division, readonly SyllableId[]>`, `wordBeat(div, accentFirst = false): Beat`, `syllableLabel(syl, groupStart): string`, `groupedBeats(groups, div, accent = true): Beat[]` (`src/content/syllables.ts`)

- [ ] **Step 1: Tools-Projekt für Tests anlegen**

Test-Dateien laufen im TypeScript-Projekt `tsconfig.tools.json` (mit Node-Typen). Die Include-Liste deckt schon alle späteren Tasks ab.

`tsconfig.tools.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tools.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "types": ["node", "vite/client"],
    "skipLibCheck": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["tools", "tests", "playwright.config.ts", "src/**/*.test.ts", "src/audio/onset/testSignals.ts", "src/audio/onset/worklet-env.d.ts"]
}
```

`tsconfig.json` ersetzen:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.tools.json" }
  ]
}
```

- [ ] **Step 2: Typen anlegen**

`src/domain/types.ts`:

```ts
export type SyllableId = 'ta' | 'ka' | 'ki' | 'di' | 'mi' | 'gi' | 'na' | 'thom'

export type Division = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Eine Rasterzelle. `syl: null` ist eine Pause. */
export type Cell = { syl: SyllableId | null; accent?: boolean }

/** Ein Schlag (Viertel) mit `div` Unterteilungen. Es gilt `cells.length === div`. */
export type Beat = { div: Division; cells: Cell[] }

export type Pattern = {
  id: string
  title: string
  /** 4 Beats pro Takt (4/4). */
  beats: Beat[]
  /** Gruppen-Klammern über alle Zellen, Summe = Anzahl Zellen. Ohne Angabe ist jeder Schlag eine Gruppe. */
  groups?: number[]
}

/** Eine zu sprechende Silbe mit Zeitpunkt in Sekunden. */
export type ExpectedEvent = {
  t: number
  syl: SyllableId
  accent: boolean
  beatIndex: number
  cellIndex: number
  groupIndex: number
  posInGroup: number
}
```

- [ ] **Step 3: Tests schreiben**

`src/domain/pattern.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { WORDS, groupedBeats, syllableLabel, wordBeat } from '../content/syllables'
import { cellCount, expectedEvents, gridStep, patternDuration, validatePattern } from './pattern'
import type { Beat, Pattern } from './types'

const four = (beat: Beat): Beat[] => [beat, beat, beat, beat]

describe('syllables', () => {
  it('hat für jede Unterteilung ein Wort passender Länge', () => {
    for (const div of [1, 2, 3, 4, 5, 6, 7] as const) expect(WORDS[div]).toHaveLength(div)
  })
  it('betont auf Wunsch die erste Silbe', () => {
    const beat = wordBeat(3, true)
    expect(beat.cells.map((c) => c.accent)).toEqual([true, false, false])
  })
  it('verteilt Gruppen-Wörter auf Schläge', () => {
    const beats = groupedBeats([3, 3, 2], 4)
    expect(beats).toHaveLength(2)
    expect(beats[0].cells.map((c) => c.syl)).toEqual(['ta', 'ki', 'ta', 'ta'])
    expect(beats[1].cells.map((c) => c.syl)).toEqual(['ki', 'ta', 'ta', 'ka'])
    expect(beats.flatMap((b) => b.cells).map((c) => c.accent)).toEqual([true, false, false, true, false, false, true, false])
    expect(() => groupedBeats([3, 3], 4)).toThrow('6 Zellen passen nicht')
  })
  it('schreibt Gruppenanfänge gross', () => {
    expect(syllableLabel('ta', true)).toBe('Ta')
    expect(syllableLabel('thom', false)).toBe('thom')
  })
})

describe('expectedEvents', () => {
  it('verteilt Triolen gleichmässig auf den Schlag', () => {
    const pattern: Pattern = { id: 'tki', title: 'Ta-ki-ta', beats: four(wordBeat(3, true)) }
    const events = expectedEvents(pattern, 60)
    expect(events).toHaveLength(12)
    expect(events[0].t).toBeCloseTo(0)
    expect(events[1].t).toBeCloseTo(1 / 3)
    expect(events[2].t).toBeCloseTo(2 / 3)
    expect(events[3].t).toBeCloseTo(1)
    expect(events.filter((e) => e.accent)).toHaveLength(4)
  })

  it('kann Unterteilungen pro Schlag mischen', () => {
    const pattern: Pattern = { id: 'mix', title: 'Mix', beats: [wordBeat(2), wordBeat(3), wordBeat(1), wordBeat(4)] }
    const times = expectedEvents(pattern, 120).map((e) => e.t)
    expect(times).toEqual([0, 0.25, 0.5, 0.5 + 0.5 / 3, 0.5 + 1 / 3, 1, 1.5, 1.625, 1.75, 1.875].map((t) => expect.closeTo(t, 9)))
  })

  it('überspringt Pausen, behält aber die Position', () => {
    const gap: Beat = { div: 4, cells: [{ syl: 'ta' }, { syl: null }, { syl: 'di' }, { syl: 'mi' }] }
    const pattern: Pattern = { id: 'gap', title: 'Lücke', beats: four(gap) }
    const events = expectedEvents(pattern, 60)
    expect(events).toHaveLength(12)
    expect(events.slice(0, 3).map((e) => e.t)).toEqual([0, 0.5, 0.75])
    expect(events[1].cellIndex).toBe(2)
  })

  it('ordnet Silben den Gruppen 3+3+2 zu', () => {
    const pattern: Pattern = {
      id: '332',
      title: '3+3+2',
      beats: four(wordBeat(4)),
      groups: [3, 3, 2, 3, 3, 2],
    }
    const events = expectedEvents(pattern, 60)
    expect(events.map((e) => e.groupIndex)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5])
    expect(events.map((e) => e.posInGroup)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 0, 1, 2, 0, 1, 2, 0, 1])
  })

  it('nimmt ohne Gruppen jeden Schlag als Gruppe', () => {
    const pattern: Pattern = { id: 'tkdm', title: 'Ta-ka-di-mi', beats: four(wordBeat(4)) }
    const events = expectedEvents(pattern, 60)
    expect(events[5].groupIndex).toBe(1)
    expect(events[5].posInGroup).toBe(1)
  })

  it('verschiebt alle Zeiten um den Offset', () => {
    const pattern: Pattern = { id: 'ta', title: 'Ta', beats: four(wordBeat(1)) }
    expect(expectedEvents(pattern, 60, 2.5).map((e) => e.t)).toEqual([2.5, 3.5, 4.5, 5.5])
  })

  it('wirft bei ungültigem Pattern', () => {
    const bad: Pattern = { id: 'bad', title: 'Kaputt', beats: four({ div: 4, cells: [{ syl: 'ta' }] }) }
    expect(() => expectedEvents(bad, 60)).toThrow(/Schlag 1 hat 1 Zellen statt 4/)
  })
})

describe('validatePattern', () => {
  it('meldet falsche Taktlänge und Gruppensumme', () => {
    const pattern: Pattern = { id: 'x', title: 'X', beats: [wordBeat(4), wordBeat(4), wordBeat(4)], groups: [3, 3] }
    const errors = validatePattern(pattern)
    expect(errors).toContain('x: Anzahl Schläge (3) ist kein Vielfaches von 4')
    expect(errors).toContain('x: Gruppen ergeben 6 Zellen statt 12')
  })
})

describe('Hilfsfunktionen', () => {
  it('berechnet Rasterschritt, Dauer und Zellenzahl', () => {
    const pattern: Pattern = { id: 's', title: 'Septolen', beats: four(wordBeat(7)) }
    expect(gridStep(pattern, 80)).toBeCloseTo(0.75 / 7)
    expect(patternDuration(pattern, 80)).toBeCloseTo(3)
    expect(cellCount(pattern)).toBe(28)
  })
})
```

`src/domain/windows.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { median } from './stats'
import { classifyOffset, timingWindows } from './windows'

describe('timingWindows', () => {
  it('skaliert mit dem Rasterschritt und begrenzt nach Spec 5.1', () => {
    expect(timingWindows(0.125)).toEqual({ tight: expect.closeTo(0.025, 9), loose: expect.closeTo(0.05625, 9) })
    expect(timingWindows(1)).toEqual({ tight: 0.05, loose: 0.12 })
    expect(timingWindows(0.07)).toEqual({ tight: 0.025, loose: 0.05 })
  })
  it('wendet die Toleranzfaktoren an', () => {
    expect(timingWindows(1, 'locker').tight).toBeCloseTo(0.07)
    expect(timingWindows(1, 'streng').loose).toBeCloseTo(0.084)
  })
})

describe('classifyOffset', () => {
  const w = { tight: 0.025, loose: 0.05 }
  it('ordnet Abweichungen ein', () => {
    expect(classifyOffset(0.01, w)).toBe('hit')
    expect(classifyOffset(-0.03, w)).toBe('early')
    expect(classifyOffset(0.04, w)).toBe('late')
    expect(classifyOffset(0.07, w)).toBe('miss')
    expect(classifyOffset(null, w)).toBe('miss')
  })
})

describe('median', () => {
  it('rechnet gerade und ungerade Längen', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNaN()
  })
})
```

- [ ] **Step 4: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/domain`
Expected: FAIL, z. B. `Failed to resolve import "./pattern"` bzw. `"../content/syllables"`.

- [ ] **Step 5: Implementierung**

`src/content/syllables.ts`:

```ts
import type { Beat, Cell, Division, SyllableId } from '../domain/types'

export const SYLLABLES: readonly SyllableId[] = ['ta', 'ka', 'ki', 'di', 'mi', 'gi', 'na', 'thom']

/** Das feste Silbenwort pro Gruppengrösse (siehe Spec 3.1). */
export const WORDS: Record<Division, readonly SyllableId[]> = {
  1: ['ta'],
  2: ['ta', 'ka'],
  3: ['ta', 'ki', 'ta'],
  4: ['ta', 'ka', 'di', 'mi'],
  5: ['ta', 'di', 'gi', 'na', 'thom'],
  6: ['ta', 'ki', 'ta', 'ta', 'ki', 'ta'],
  7: ['ta', 'ki', 'ta', 'ta', 'ka', 'di', 'mi'],
}

/** Ein Schlag, der genau das Wort seiner Unterteilung enthält. */
export function wordBeat(div: Division, accentFirst = false): Beat {
  const cells: Cell[] = WORDS[div].map((syl, i) => ({ syl, accent: accentFirst && i === 0 }))
  return { div, cells }
}

/** Anzeige einer Silbe: Gruppenanfang gross ("Ta"), sonst klein ("ki"). */
export function syllableLabel(syl: SyllableId, groupStart: boolean): string {
  return groupStart ? syl.charAt(0).toUpperCase() + syl.slice(1) : syl
}

/** Reiht Gruppen-Wörter aneinander und verteilt sie auf Schläge, z. B. [3, 3, 2] mit div 4 → Ta ki ta Ta | ki ta Ta ka. */
export function groupedBeats(groups: number[], div: Division, accent = true): Beat[] {
  const cells: Cell[] = groups.flatMap((size) => {
    if (!Number.isInteger(size) || size < 1 || size > 7) throw new Error(`Gruppengrösse ${size} wird nicht unterstützt`)
    return WORDS[size as Division].map((syl, i) => ({ syl, accent: accent && i === 0 }))
  })
  if (cells.length % div !== 0) throw new Error(`${cells.length} Zellen passen nicht in Schläge zu ${div}`)
  const beats: Beat[] = []
  for (let i = 0; i < cells.length; i += div) beats.push({ div, cells: cells.slice(i, i + div) })
  return beats
}
```

`src/domain/pattern.ts`:

```ts
import type { ExpectedEvent, Pattern } from './types'

export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function cellCount(pattern: Pattern): number {
  return pattern.beats.reduce((n, beat) => n + beat.cells.length, 0)
}

export function patternDuration(pattern: Pattern, bpm: number): number {
  return pattern.beats.length * beatDuration(bpm)
}

/** Dauer der feinsten Unterteilung im Pattern, in Sekunden. */
export function gridStep(pattern: Pattern, bpm: number): number {
  const maxDiv = Math.max(...pattern.beats.map((beat) => beat.div))
  return beatDuration(bpm) / maxDiv
}

/** Liefert Fehlermeldungen (Deutsch). Leeres Array = gültig. */
export function validatePattern(pattern: Pattern): string[] {
  const errors: string[] = []
  if (pattern.beats.length === 0 || pattern.beats.length % 4 !== 0) {
    errors.push(`${pattern.id}: Anzahl Schläge (${pattern.beats.length}) ist kein Vielfaches von 4`)
  }
  pattern.beats.forEach((beat, i) => {
    if (beat.cells.length !== beat.div) {
      errors.push(`${pattern.id}: Schlag ${i + 1} hat ${beat.cells.length} Zellen statt ${beat.div}`)
    }
  })
  if (pattern.groups) {
    const sum = pattern.groups.reduce((a, b) => a + b, 0)
    if (sum !== cellCount(pattern)) {
      errors.push(`${pattern.id}: Gruppen ergeben ${sum} Zellen statt ${cellCount(pattern)}`)
    }
  }
  return errors
}

function locateGroup(
  groups: number[] | undefined,
  flatIndex: number,
  beatIndex: number,
  cellIndex: number,
): { groupIndex: number; posInGroup: number } {
  if (!groups) return { groupIndex: beatIndex, posInGroup: cellIndex }
  let start = 0
  for (let g = 0; g < groups.length; g++) {
    if (flatIndex < start + groups[g]) return { groupIndex: g, posInGroup: flatIndex - start }
    start += groups[g]
  }
  throw new Error(`Gruppen decken Zelle ${flatIndex} nicht ab`)
}

/** Alle gesprochenen Silben eines Durchgangs mit Zeitpunkt (Pausen werden übersprungen). */
export function expectedEvents(pattern: Pattern, bpm: number, offset = 0): ExpectedEvent[] {
  const errors = validatePattern(pattern)
  if (errors.length > 0) throw new Error(errors.join('; '))
  const bd = beatDuration(bpm)
  const events: ExpectedEvent[] = []
  let flat = 0
  pattern.beats.forEach((beat, beatIndex) => {
    beat.cells.forEach((cell, cellIndex) => {
      const { groupIndex, posInGroup } = locateGroup(pattern.groups, flat, beatIndex, cellIndex)
      if (cell.syl !== null) {
        events.push({
          t: offset + beatIndex * bd + (cellIndex * bd) / beat.div,
          syl: cell.syl,
          accent: cell.accent === true,
          beatIndex,
          cellIndex,
          groupIndex,
          posInGroup,
        })
      }
      flat++
    })
  })
  return events
}
```

`src/domain/stats.ts`:

```ts
export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
```

`src/domain/windows.ts`:

```ts
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
```

- [ ] **Step 6: Tests und Typecheck**

Run: `npx vitest run src/domain && npm run typecheck`
Expected: 17 Tests PASS (13 in `pattern.test.ts`, 4 in `windows.test.ts`), `tsc -b` ohne Ausgabe.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json tsconfig.tools.json src/domain src/content
git commit -m "feat: Rhythmus-Domäne mit Silbenwörtern, Zeitpunkten und Zeitfenstern" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: WAV und Pegel

**Files:**
- Create: `src/audio/dsp/wav.ts`, `src/audio/dsp/level.ts`
- Test: `src/audio/dsp/dsp.test.ts`

**Interfaces:**
- Produces: `pcm16ToFloat(bytes: Uint8Array): Float32Array`, `encodeWav16(samples, sampleRate): Uint8Array<ArrayBuffer>`, `decodeWav(bytes): { sampleRate, samples }` (`wav.ts`); `toDb`, `fromDb`, `peak`, `rms`, `normalizePeak(samples, targetDb)`, `fadeOut(samples, sampleRate, ms)` (`level.ts`)

- [ ] **Step 1: Tests schreiben**

`src/audio/dsp/dsp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fadeOut, fromDb, normalizePeak, peak, rms, toDb } from './level'
import { decodeWav, encodeWav16, pcm16ToFloat } from './wav'

describe('wav', () => {
  it('schreibt einen gültigen 16-Bit-Mono-Header', () => {
    const bytes = encodeWav16(new Float32Array(10), 24000)
    const view = new DataView(bytes.buffer)
    const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4))
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(24000)
    expect(view.getUint32(28, true)).toBe(48000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(20)
    expect(bytes.byteLength).toBe(64)
  })

  it('übersteht Hin- und Rückweg mit 16-Bit-Genauigkeit', () => {
    const input = Float32Array.from({ length: 500 }, (_, i) => Math.sin(i / 7) * 0.8)
    const { sampleRate, samples } = decodeWav(encodeWav16(input, 48000))
    expect(sampleRate).toBe(48000)
    expect(samples).toHaveLength(500)
    samples.forEach((s, i) => expect(Math.abs(s - input[i])).toBeLessThan(1 / 16000))
  })

  it('begrenzt Werte ausserhalb von -1..1', () => {
    const { samples } = decodeWav(encodeWav16(Float32Array.from([2, -2]), 8000))
    expect(samples[0]).toBeCloseTo(32767 / 32768, 4)
    expect(samples[1]).toBe(-1)
  })

  it('wandelt rohes PCM16 in Float', () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0]) // 16384, -16384
    expect(Array.from(pcm16ToFloat(bytes))).toEqual([0.5, -0.5])
  })

  it('lehnt Nicht-WAV ab', () => {
    expect(() => decodeWav(new Uint8Array(44))).toThrow('Keine WAV-Datei')
  })
})

describe('level', () => {
  it('rechnet zwischen Amplitude und dB', () => {
    expect(toDb(1)).toBeCloseTo(0)
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1)
    expect(fromDb(-6.0206)).toBeCloseTo(0.5, 3)
  })

  it('misst Spitze und RMS', () => {
    const s = Float32Array.from([0.5, -1, 0.5, 0])
    expect(peak(s)).toBe(1)
    expect(rms(s)).toBeCloseTo(Math.sqrt(1.5 / 4))
  })

  it('normalisiert auf den Ziel-Spitzenpegel', () => {
    const out = normalizePeak(Float32Array.from([0.1, -0.2]), -6)
    expect(toDb(peak(out))).toBeCloseTo(-6, 5)
  })

  it('blendet linear aus und endet bei 0', () => {
    const out = fadeOut(new Float32Array(100).fill(1), 1000, 10)
    expect(out[89]).toBe(1)
    expect(out[95]).toBeCloseTo(0.4)
    expect(out[99]).toBe(0)
  })
})
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/audio/dsp`
Expected: FAIL mit `Failed to resolve import "./level"`.

- [ ] **Step 3: Implementierung**

`src/audio/dsp/wav.ts`:

```ts
/** Rohes PCM (16 Bit, signed, little-endian, mono) nach Float32 im Bereich -1..1. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const n = Math.floor(bytes.byteLength / 2)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return out
}

/** Mono-WAV mit 16 Bit PCM. Werte ausserhalb -1..1 werden begrenzt. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, tag.charCodeAt(i))
  }
  writeTag(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeTag(8, 'WAVE')
  writeTag(12, 'fmt ')
  view.setUint32(16, 16, true) // Grösse fmt-Chunk
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // Byte-Rate
  view.setUint16(32, 2, true) // Block-Align
  view.setUint16(34, 16, true) // Bits pro Sample
  writeTag(36, 'data')
  view.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true)
  }
  return new Uint8Array(buffer)
}

/** Liest 16-Bit-PCM-WAV (mono oder mehrkanalig, Kanäle werden gemittelt). */
export function decodeWav(bytes: Uint8Array): { sampleRate: number; samples: Float32Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Keine WAV-Datei')
  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bits = 0
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      const format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
      if (format !== 1 || bits !== 16) throw new Error(`Nur 16-Bit-PCM wird unterstützt (Format ${format}, ${bits} Bit)`)
    } else if (id === 'data') {
      if (!sampleRate) throw new Error('fmt-Chunk fehlt vor data-Chunk')
      const frames = Math.floor(size / (2 * channels))
      const samples = new Float32Array(frames)
      for (let f = 0; f < frames; f++) {
        let sum = 0
        for (let c = 0; c < channels; c++) sum += view.getInt16(body + (f * channels + c) * 2, true) / 32768
        samples[f] = sum / channels
      }
      return { sampleRate, samples }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('data-Chunk fehlt')
}
```

`src/audio/dsp/level.ts`:

```ts
export function toDb(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, 1e-12))
}

export function fromDb(db: number): number {
  return 10 ** (db / 20)
}

export function peak(samples: Float32Array): number {
  let p = 0
  for (const s of samples) p = Math.max(p, Math.abs(s))
  return p
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

/** Neue Kopie, deren Spitzenpegel `targetDb` dBFS beträgt. */
export function normalizePeak(samples: Float32Array, targetDb: number): Float32Array {
  const p = peak(samples)
  if (p === 0) return samples.slice()
  const gain = fromDb(targetDb) / p
  return samples.map((s) => s * gain)
}

/** Neue Kopie mit linearem Ausblenden über die letzten `ms` Millisekunden. */
export function fadeOut(samples: Float32Array, sampleRate: number, ms: number): Float32Array {
  const out = samples.slice()
  const n = Math.min(out.length, Math.round((sampleRate * ms) / 1000))
  for (let i = 0; i < n; i++) out[out.length - n + i] *= 1 - (i + 1) / n
  return out
}
```

- [ ] **Step 4: Tests und Typecheck**

Run: `npx vitest run src/audio/dsp && npm run typecheck`
Expected: 9 Tests PASS, keine Typfehler.

- [ ] **Step 5: Commit**

```bash
git add src/audio/dsp
git commit -m "feat: WAV lesen und schreiben, Pegel-Hilfen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Einsatz-Erkennung (Detektor)

**Files:**
- Create: `src/audio/onset/detector.ts`, `src/audio/onset/testSignals.ts`
- Test: `src/audio/onset/detector.test.ts`

**Interfaces:**
- Consumes: `fromDb` (Task 4), `median` (Task 3)
- Produces:
  - `type DetectorParams`, `DEFAULT_DETECTOR_PARAMS`, `minIoiForGrid(stepSeconds): number`
  - `type Onset = { time; frame; peakDb }`, `type FrameStat = { time; energyDb; floorDb }`
  - `class OnsetDetector(sampleRate, params?)` mit `process(samples, startFrame): { onsets, frames }`, `flush(): Onset[]`, `setParams(p)`, `getParams()`
  - `detectOnsets(samples, sampleRate, params?): Onset[]`
  - Testhilfen: `prng`, `synthSyllable`, `referencePoint`, `addNoise`, `placeSyllables`, `matchStats` (`testSignals.ts`)

Algorithmus (Spec 7.4): Hochpass 150 Hz, Energie pro Hop (128 Samples bei 48 kHz), über ca. 10 ms geglättet. Tal → Gipfel (Anstieg ≥ 6 dB, ≥ 12 dB über Grundpegel, ≥ −60 dBFS); Gipfel bestätigt bei 3 dB Abfall oder nach 30 ms. Einsatz = erster Hop im Anstieg mit Energie ≥ Gipfel − 6 dB. Ein Kandidat innerhalb 80 ms mit ≥ 6 dB lauterem Gipfel ersetzt den vorigen (Konsonant → Vokal). Mindestabstand `minIoiSeconds`.

- [ ] **Step 1: Testhilfen anlegen** (synthetische Silbe: Rauschknall, Lücke, Vokal; Platzierung mit "Choke" wie bei der Wiedergabe)

`src/audio/onset/testSignals.ts`:

```ts
/** Synthetische Testsignale für die Einsatz-Erkennung (nur in Tests verwendet). */
import { fromDb } from '../dsp/level'
import { detectOnsets } from './detector'

/** Deterministischer Zufall (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normalverteiltes Rauschen (Box-Muller). */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

export type SynthSyllableOptions = { vowelDb?: number; burstDb?: number; seed?: number }

/**
 * Silben-Attrappe: 6 ms Rausch-Knall (Konsonant), 35 ms Lücke, 150 ms Vokal
 * (Obertonreihe auf 140 Hz, 12 ms Anstieg, 40 ms Ausklang).
 */
export function synthSyllable(sampleRate: number, opts: SynthSyllableOptions = {}): Float32Array {
  const { vowelDb = -8, burstDb = -28, seed = 1 } = opts
  const rand = prng(seed)
  const burstN = Math.round(0.006 * sampleRate)
  const gapN = Math.round(0.035 * sampleRate)
  const vowelN = Math.round(0.15 * sampleRate)
  const out = new Float32Array(burstN + gapN + vowelN)
  const burstAmp = fromDb(burstDb)
  for (let i = 0; i < burstN; i++) out[i] = gaussian(rand) * burstAmp * (1 - i / burstN)
  const attack = Math.round(0.012 * sampleRate)
  const release = Math.round(0.04 * sampleRate)
  const vowel = new Float32Array(vowelN)
  let max = 0
  for (let i = 0; i < vowelN; i++) {
    const t = i / sampleRate
    let v = 0
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * 140 * h * t) / h
    const env = Math.min(1, i / attack, (vowelN - i) / release)
    vowel[i] = v * env
    max = Math.max(max, Math.abs(vowel[i]))
  }
  const vowelAmp = fromDb(vowelDb) / max
  for (let i = 0; i < vowelN; i++) out[burstN + gapN + i] = vowel[i] * vowelAmp
  return out
}

/** Einsatzpunkt, den der Detektor in einer isolierten Silbe findet (Sekunden ab Silbenbeginn). */
export function referencePoint(syllable: Float32Array, sampleRate: number): number {
  const lead = Math.round(0.2 * sampleRate)
  const padded = new Float32Array(lead + syllable.length + Math.round(0.3 * sampleRate))
  padded.set(syllable, lead)
  addNoise(padded, -75, 99)
  const onsets = detectOnsets(padded, sampleRate)
  if (onsets.length === 0) throw new Error('Kein Einsatz in isolierter Silbe gefunden')
  return onsets[0].time - lead / sampleRate
}

export function addNoise(samples: Float32Array, noiseDb: number, seed: number): void {
  const rand = prng(seed)
  const amp = fromDb(noiseDb)
  for (let i = 0; i < samples.length; i++) samples[i] += gaussian(rand) * amp
}

/**
 * Setzt Silben so, dass ihr Referenzpunkt genau auf `targets` liegt. Jede Silbe wird beim
 * Beginn der nächsten abgeschnitten (5 ms Ausblenden), wie in der echten Wiedergabe.
 */
export function placeSyllables(
  sampleRate: number,
  targets: number[],
  syllables: Float32Array[],
  refs: number[],
  totalSeconds: number,
): Float32Array {
  const out = new Float32Array(Math.round(totalSeconds * sampleRate))
  const starts = targets.map((t, i) => Math.round((t - refs[i % refs.length]) * sampleRate))
  const fade = Math.round(0.005 * sampleRate)
  starts.forEach((start, i) => {
    const syl = syllables[i % syllables.length]
    const end = Math.min(start + syl.length, i + 1 < starts.length ? starts[i + 1] : Infinity, out.length)
    const len = end - start
    for (let j = 0; j < len; j++) {
      const g = j >= len - fade ? (len - j) / fade : 1
      out[start + j] += syl[j] * g
    }
  })
  return out
}

export type MatchStats = { matched: number; extras: number; errors: number[] }

/** Ordnet jedem Ziel den nächsten Einsatz innerhalb ±halber Rasterschritt zu. */
export function matchStats(targets: number[], onsetTimes: number[], step: number): MatchStats {
  const used = new Set<number>()
  const errors: number[] = []
  for (const t of targets) {
    let best = -1
    for (let j = 0; j < onsetTimes.length; j++) {
      if (used.has(j)) continue
      if (best === -1 || Math.abs(onsetTimes[j] - t) < Math.abs(onsetTimes[best] - t)) best = j
    }
    if (best !== -1 && Math.abs(onsetTimes[best] - t) < step / 2) {
      used.add(best)
      errors.push(onsetTimes[best] - t)
    }
  }
  return { matched: errors.length, extras: onsetTimes.length - used.size, errors }
}
```

- [ ] **Step 2: Tests schreiben**

`src/audio/onset/detector.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { OnsetDetector, detectOnsets, minIoiForGrid } from './detector'
import { median } from '../../domain/stats'
import { addNoise, matchStats, placeSyllables, referencePoint, synthSyllable } from './testSignals'

const SR = 48000

function sequence(bpm: number, div: number, count: number, noiseDb: number, vowelDbs: number[] = [-8]) {
  const step = 60 / bpm / div
  const syllables = vowelDbs.map((db, i) => synthSyllable(SR, { vowelDb: db, seed: i + 1 }))
  const refs = syllables.map((s) => referencePoint(s, SR))
  const targets = Array.from({ length: count }, (_, k) => 0.4 + k * step)
  const signal = placeSyllables(SR, targets, syllables, refs, 0.4 + count * step + 0.6)
  addNoise(signal, noiseDb, 7)
  return { signal, targets, step }
}

describe('OnsetDetector', () => {
  it('setzt den Einsatz einer Silbe auf den Vokal, nicht auf den Konsonanten', () => {
    const syl = synthSyllable(SR)
    const ref = referencePoint(syl, SR)
    const vowelStart = 0.006 + 0.035
    expect(ref).toBeGreaterThan(vowelStart - 0.01)
    expect(ref).toBeLessThan(vowelStart + 0.015)
  })

  it('findet nichts in reinem Rauschen', () => {
    const noise = new Float32Array(SR * 2)
    addNoise(noise, -50, 3)
    expect(detectOnsets(noise, SR)).toEqual([])
  })

  it('erkennt 16tel bei 120 BPM genau', () => {
    const { signal, targets, step } = sequence(120, 4, 32, -60)
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const stats = matchStats(targets, onsets.map((o) => o.time), step)
    expect(stats.matched).toBe(32)
    expect(stats.extras).toBe(0)
    expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.003)
    expect(Math.max(...stats.errors.map(Math.abs))).toBeLessThan(0.01)
  })

  it('bleibt bei deutlichem Rauschen (-40 dBFS) zuverlässig', () => {
    const { signal, targets, step } = sequence(120, 4, 32, -40)
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const stats = matchStats(targets, onsets.map((o) => o.time), step)
    expect(stats.matched).toBeGreaterThanOrEqual(31)
    expect(stats.extras).toBeLessThanOrEqual(1)
    expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.005)
  })

  it('erkennt Septolen bei 80 BPM', () => {
    const { signal, targets, step } = sequence(80, 7, 28, -60)
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const stats = matchStats(targets, onsets.map((o) => o.time), step)
    expect(stats.matched).toBe(28)
    expect(stats.extras).toBe(0)
  })

  it('liefert Pegelunterschiede für Akzente', () => {
    const { signal, step } = sequence(100, 2, 16, -60, [-8, -14])
    const onsets = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    expect(onsets).toHaveLength(16)
    const diffs = onsets.slice(0, 14).filter((_, i) => i % 2 === 0).map((o, i) => o.peakDb - onsets[i * 2 + 1].peakDb)
    for (const d of diffs) expect(d).toBeGreaterThan(4.5)
  })

  it('liefert blockweise dieselben Einsätze wie am Stück', () => {
    const { signal, step } = sequence(100, 3, 12, -60)
    const whole = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    const detector = new OnsetDetector(SR, { minIoiSeconds: minIoiForGrid(step) })
    const streamed = []
    for (let i = 0; i < signal.length; i += 128) {
      streamed.push(...detector.process(signal.subarray(i, i + 128), i).onsets)
    }
    streamed.push(...detector.flush())
    expect(streamed.map((o) => o.time)).toEqual(whole.map((o) => o.time))
  })

  it('rechnet Zeiten ab dem Start-Frame des ersten Blocks', () => {
    const { signal, step } = sequence(60, 1, 4, -60)
    const detector = new OnsetDetector(SR, { minIoiSeconds: minIoiForGrid(step) })
    const shifted = [...detector.process(signal, SR).onsets, ...detector.flush()]
    const plain = detectOnsets(signal, SR, { minIoiSeconds: minIoiForGrid(step) })
    expect(shifted.map((o) => o.time - 1)).toEqual(plain.map((o) => expect.closeTo(o.time, 9)))
  })

  it('meldet Energie und Grundpegel pro Hop', () => {
    const detector = new OnsetDetector(SR)
    const { frames } = detector.process(new Float32Array(1280), 0)
    expect(frames).toHaveLength(10)
    expect(frames[1].time).toBeCloseTo(128 / SR)
  })
})
```

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/audio/onset`
Expected: FAIL mit `Failed to resolve import "./detector"`.

- [ ] **Step 4: Implementierung**

`src/audio/onset/detector.ts`:

```ts
/**
 * Erkennt Silben-Einsätze in einem Audiostrom.
 *
 * Idee: Gemessen wird die geglättete Energie (Hochpass 150 Hz, ca. 10 ms Fenster).
 * Eine Silbe ist ein Anstieg vom Tal zum Gipfel. Als Einsatz gilt die Stelle, an der
 * der Anstieg `belowPeakDb` unter dem Gipfel liegt. Das ist praktisch der Vokalbeginn
 * und damit nahe am wahrgenommenen Schlag (P-Center). Ein schwacher Konsonanten-Knall
 * direkt vor einem deutlich lauteren Vokal wird auf den Vokal umgehängt.
 *
 * Der Detektor ist rein (keine Browser-APIs) und läuft im AudioWorklet sowie offline in Tests.
 */

export type DetectorParams = {
  /** Nur bei der Konstruktion wirksam. */
  hopSeconds: number
  /** Nur bei der Konstruktion wirksam. */
  highpassHz: number
  /** Nur bei der Konstruktion wirksam. */
  smoothSeconds: number
  riseDb: number
  peakDropDb: number
  peakHoldSeconds: number
  belowPeakDb: number
  aboveFloorDb: number
  minLevelDb: number
  floorRiseDbPerSecond: number
  mergeSeconds: number
  mergeDb: number
  minIoiSeconds: number
}

export const DEFAULT_DETECTOR_PARAMS: DetectorParams = {
  hopSeconds: 128 / 48000,
  highpassHz: 150,
  smoothSeconds: 0.0107,
  riseDb: 6,
  peakDropDb: 3,
  peakHoldSeconds: 0.03,
  belowPeakDb: 6,
  aboveFloorDb: 12,
  minLevelDb: -60,
  floorRiseDbPerSecond: 6,
  mergeSeconds: 0.08,
  mergeDb: 6,
  minIoiSeconds: 0.06,
}

/** Mindestabstand zwischen zwei Einsätzen für einen Rasterschritt (Spec 7.4, angepasst nach Prototyp). */
export function minIoiForGrid(stepSeconds: number): number {
  return Math.max(0.04, 0.6 * stepSeconds)
}

export type Onset = {
  /** Sekunden auf der Zeitachse des Eingangs (Frame / sampleRate). */
  time: number
  frame: number
  /** Gipfel der geglätteten Energie in dB, für Akzent-Vergleiche. */
  peakDb: number
}

export type FrameStat = { time: number; energyDb: number; floorDb: number }

export class OnsetDetector {
  private readonly sampleRate: number
  private params: DetectorParams
  private readonly hop: number
  private readonly smoothHops: number
  private readonly hpA: number
  private holdHops = 1
  private prevX = 0
  private prevY = 0
  private hopSum = 0
  private hopFill = 0
  private hopCount = 0
  private originFrame = 0
  private originSet = false
  private readonly powerRing: number[] = []
  private readonly energyRing: Float64Array
  private floorDb = Number.NaN
  private state: 'valley' | 'rise' = 'valley'
  private valleyHop = 0
  private valleyDb = Number.POSITIVE_INFINITY
  private peakHop = 0
  private peakDb = Number.NEGATIVE_INFINITY
  private pending: Onset | null = null
  private lastEmitted = Number.NEGATIVE_INFINITY

  constructor(sampleRate: number, params: Partial<DetectorParams> = {}) {
    this.sampleRate = sampleRate
    this.params = { ...DEFAULT_DETECTOR_PARAMS, ...params }
    this.hop = Math.max(16, Math.round(sampleRate * this.params.hopSeconds))
    const hopS = this.hop / sampleRate
    this.smoothHops = Math.max(1, Math.round(this.params.smoothSeconds / hopS))
    const rc = 1 / (2 * Math.PI * this.params.highpassHz)
    this.hpA = rc / (rc + 1 / sampleRate)
    this.energyRing = new Float64Array(Math.ceil(1 / hopS))
    this.applyParams()
  }

  setParams(params: Partial<DetectorParams>): void {
    this.params = { ...this.params, ...params }
    this.applyParams()
  }

  getParams(): DetectorParams {
    return { ...this.params }
  }

  /** Verarbeitet einen zusammenhängenden Block. `startFrame` des ersten Blocks legt den Nullpunkt fest. */
  process(samples: Float32Array, startFrame: number): { onsets: Onset[]; frames: FrameStat[] } {
    if (!this.originSet) {
      this.originFrame = startFrame
      this.originSet = true
    }
    const onsets: Onset[] = []
    const frames: FrameStat[] = []
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]
      const y = this.hpA * (this.prevY + x - this.prevX)
      this.prevX = x
      this.prevY = y
      this.hopSum += y * y
      this.hopFill++
      if (this.hopFill === this.hop) {
        this.finishHop(onsets, frames)
        this.hopSum = 0
        this.hopFill = 0
      }
    }
    return { onsets, frames }
  }

  /** Gibt einen noch zurückgehaltenen Einsatz frei (am Ende einer Aufnahme aufrufen). */
  flush(): Onset[] {
    if (!this.pending) return []
    const out = [this.pending]
    this.lastEmitted = this.pending.time
    this.pending = null
    return out
  }

  private applyParams(): void {
    this.holdHops = Math.max(1, Math.round(this.params.peakHoldSeconds / (this.hop / this.sampleRate)))
  }

  private hopTime(k: number): number {
    return (this.originFrame + k * this.hop) / this.sampleRate
  }

  private energyAt(k: number): number {
    return this.energyRing[k % this.energyRing.length]
  }

  private emit(onsets: Onset[], onset: Onset): void {
    onsets.push(onset)
    this.lastEmitted = onset.time
  }

  private finishHop(onsets: Onset[], frames: FrameStat[]): void {
    const p = this.params
    const k = this.hopCount++
    this.powerRing.push(this.hopSum / this.hop)
    if (this.powerRing.length > this.smoothHops) this.powerRing.shift()
    let mean = 0
    for (const v of this.powerRing) mean += v
    mean /= this.powerRing.length
    const e = 10 * Math.log10(mean + 1e-12)
    this.energyRing[k % this.energyRing.length] = e
    if (Number.isNaN(this.floorDb)) this.floorDb = e

    if (this.state === 'valley') {
      if (e < this.valleyDb) {
        this.valleyDb = e
        this.valleyHop = k
      }
      if (e >= this.valleyDb + p.riseDb && e >= this.floorDb + p.aboveFloorDb && e >= p.minLevelDb) {
        this.state = 'rise'
        this.peakHop = k
        this.peakDb = e
      }
    } else {
      if (e > this.peakDb) {
        this.peakDb = e
        this.peakHop = k
      }
      if (e <= this.peakDb - p.peakDropDb || k - this.peakHop >= this.holdHops) {
        this.confirmPeak(onsets)
        this.state = 'valley'
        this.valleyDb = e
        this.valleyHop = k
      }
    }

    // Ein zurückgehaltener Einsatz kann nicht mehr umgehängt werden, sobald jeder
    // künftige Anstieg (frühestens ab dem aktuellen Tal) ausserhalb des Merge-Fensters liegt.
    if (this.pending && this.hopTime(this.valleyHop) - this.pending.time >= p.mergeSeconds) {
      this.emit(onsets, this.pending)
      this.pending = null
    }

    const hopS = this.hop / this.sampleRate
    this.floorDb = e < this.floorDb ? e : Math.min(this.floorDb + p.floorRiseDbPerSecond * hopS, e)
    frames.push({ time: this.hopTime(k), energyDb: e, floorDb: this.floorDb })
  }

  private confirmPeak(onsets: Onset[]): void {
    const p = this.params
    const from = Math.max(this.valleyHop, this.hopCount - this.energyRing.length)
    let cross = this.peakHop
    for (let j = from; j <= this.peakHop; j++) {
      if (this.energyAt(j) >= this.peakDb - p.belowPeakDb) {
        cross = j
        break
      }
    }
    const candidate: Onset = {
      time: this.hopTime(cross),
      frame: this.originFrame + cross * this.hop,
      peakDb: this.peakDb,
    }
    const prev = this.pending
    if (prev && candidate.time - prev.time < p.mergeSeconds && candidate.peakDb >= prev.peakDb + p.mergeDb) {
      this.pending = candidate
      return
    }
    const lastTime = prev ? prev.time : this.lastEmitted
    if (candidate.time - lastTime >= p.minIoiSeconds) {
      if (prev) this.emit(onsets, prev)
      this.pending = candidate
    }
  }
}

/** Bequeme Offline-Variante für ganze Aufnahmen. */
export function detectOnsets(samples: Float32Array, sampleRate: number, params: Partial<DetectorParams> = {}): Onset[] {
  const detector = new OnsetDetector(sampleRate, params)
  const { onsets } = detector.process(samples, 0)
  return [...onsets, ...detector.flush()]
}
```

- [ ] **Step 5: Tests und Typecheck**

Run: `npx vitest run src/audio/onset && npm run typecheck`
Expected: 9 Tests PASS. (Im Prototyp: Median-Fehler bei 16teln mit 120 BPM ca. 1 ms, auch bei −40 dBFS Rauschen.)

- [ ] **Step 6: Commit**

```bash
git add src/audio/onset
git commit -m "feat: Einsatz-Erkennung mit Vokalbeginn als Messpunkt" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 6: Sound-Werkzeug und generierte Sounds

**Files:**
- Create: `src/audio/manifest.ts`, `tools/lib/analyze.ts`, `tools/lib/elevenlabs.ts`, `tools/lib/takes.ts`, `tools/sounds.config.json`, `tools/generate-sounds.ts`
- Test: `tools/lib/analyze.test.ts`, `tools/lib/elevenlabs.test.ts`, `tools/lib/takes.test.ts`, `src/audio/onset/realSamples.test.ts`
- Modify: `docker-compose.yml` (Service `sounds`)
- Create (generiert): `public/sounds/*.wav`, `public/sounds/manifest.json`

**Interfaces:**
- Consumes: `detectOnsets` (Task 5), `pcm16ToFloat`, `encodeWav16`, `decodeWav`, `normalizePeak`, `fadeOut`, `toDb` (Task 4), `SYLLABLES`, `WORDS` (Task 3)
- Produces:
  - `type CountWord`, `type UiSound`, `COUNT_WORDS`, `UI_SOUNDS`, `type SoundRef = { file; refSeconds; durationSeconds }`, `type SoundManifest` (`src/audio/manifest.ts`)
  - `public/sounds/manifest.json` mit `syllables[syl].normal|accent`, `count[word]`, `ui[name]`; Dateien `syl-<syl>.wav`, `syl-<syl>-accent.wav`, `count-<word>.wav`, `ui-<name>.wav`
  - CLI `npm run sounds -- voices | build` und `docker compose run --rm sounds voices | build`

- [ ] **Step 1: Manifest-Typen**

`src/audio/manifest.ts`:

```ts
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
```

- [ ] **Step 2: Tests für Aufbereitung, API-Client und Take-Wahl schreiben**

`tools/lib/analyze.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { peak, toDb } from '../../src/audio/dsp/level'
import { synthSyllable } from '../../src/audio/onset/testSignals'
import { firstAbove, lastAbove, prepareSyllable, prepareUiSound } from './analyze'

const SR = 24000

function withSilence(sound: Float32Array, leadSeconds: number, tailSeconds: number): Float32Array {
  const out = new Float32Array(Math.round((leadSeconds + tailSeconds) * SR) + sound.length)
  out.set(sound, Math.round(leadSeconds * SR))
  return out
}

describe('firstAbove / lastAbove', () => {
  it('findet Anfang und Ende eines Klangs', () => {
    const tone = new Float32Array(2400).fill(0.5)
    const signal = withSilence(tone, 0.1, 0.1)
    expect(firstAbove(signal, SR, -45) / SR).toBeCloseTo(0.1 - 0.004, 2)
    expect(lastAbove(signal, SR, -45) / SR).toBeCloseTo(0.2 + 0.004, 2)
    expect(firstAbove(new Float32Array(2400), SR, -45)).toBe(-1)
  })
})

describe('prepareSyllable', () => {
  const raw = withSilence(synthSyllable(SR), 0.11, 0.3)
  const prepared = prepareSyllable(raw, SR, { peakDb: -7 })

  it('schneidet die Stille vorne bis kurz vor den Konsonanten weg', () => {
    expect(firstAbove(prepared.samples, SR, -45) / SR).toBeLessThan(0.004)
  })

  it('setzt den Referenzpunkt auf den Vokal', () => {
    const vowelStart = 0.006 + 0.035
    expect(prepared.refSeconds).toBeGreaterThan(vowelStart - 0.01)
    expect(prepared.refSeconds).toBeLessThan(vowelStart + 0.02)
  })

  it('kürzt auf Einsatz + 130 ms, blendet aus und normalisiert', () => {
    expect(prepared.samples.length / SR).toBeCloseTo(prepared.refSeconds + 0.13, 2)
    expect(prepared.samples[prepared.samples.length - 1]).toBeCloseTo(0)
    expect(toDb(peak(prepared.samples))).toBeCloseTo(-7, 3)
    expect(prepared.onsetCount).toBe(1)
  })

  it('meldet zu leise Aufnahmen', () => {
    expect(() => prepareSyllable(new Float32Array(SR), SR, { peakDb: -7 })).toThrow('zu leise')
  })
})

describe('prepareUiSound', () => {
  it('schneidet Stille ab und begrenzt die Länge', () => {
    const tone = Float32Array.from({ length: SR * 3 }, (_, i) => Math.sin(i / 3) * 0.3)
    const out = prepareUiSound(withSilence(tone, 0.2, 0.5), SR, -3, 1.5)
    expect(out.length / SR).toBeCloseTo(1.5, 2)
    expect(toDb(peak(out))).toBeCloseTo(-3, 3)
  })
})
```

`tools/lib/elevenlabs.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ElevenLabsClient } from './elevenlabs'

function okResponse(body: BodyInit): Response {
  return new Response(body, { status: 200 })
}

describe('ElevenLabsClient', () => {
  it('verlangt einen API-Key', () => {
    expect(() => new ElevenLabsClient('')).toThrow('ELEVENLABS_API fehlt')
  })

  it('ruft Text-to-Speech mit PCM 24 kHz auf und liefert Float32', async () => {
    const fetchFn = vi.fn(async () => okResponse(new Uint8Array([0x00, 0x40, 0x00, 0xc0])))
    const client = new ElevenLabsClient('key-123', fetchFn)
    const samples = await client.tts('voice-1', 'Tah.', { modelId: 'eleven_multilingual_v2', seed: 3 })
    expect(Array.from(samples)).toEqual([0.5, -0.5])
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=pcm_24000')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'xi-api-key': 'key-123' })
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Tah.', model_id: 'eleven_multilingual_v2', seed: 3 })
  })

  it('ruft Sound-Effekte mit Dauer auf', async () => {
    const fetchFn = vi.fn(async () => okResponse(new Uint8Array(4)))
    const client = new ElevenLabsClient('k', fetchFn)
    await client.soundEffect('short marimba chime', 0.8)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_24000')
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'short marimba chime', duration_seconds: 0.8 })
  })

  it('listet Stimmen', async () => {
    const fetchFn = vi.fn(async () => okResponse(JSON.stringify({ voices: [{ voice_id: 'a', name: 'River', category: 'premade', labels: {} }] })))
    const voices = await new ElevenLabsClient('k', fetchFn).listVoices()
    expect(voices[0].name).toBe('River')
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain('/v2/voices?page_size=100&category=premade')
  })

  it('meldet API-Fehler mit Status und Text', async () => {
    const fetchFn = vi.fn(async () => new Response('{"detail":"quota_exceeded"}', { status: 401 }))
    const client = new ElevenLabsClient('k', fetchFn)
    await expect(client.tts('v', 'Tah.', { modelId: 'm' })).rejects.toThrow(/\(401\).*quota_exceeded/)
  })
})
```

`tools/lib/takes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PreparedSyllable } from './analyze'
import { chooseTake } from './takes'

const take = (onsetCount: number): PreparedSyllable => ({ samples: new Float32Array(1), refSeconds: 0.05, onsetCount })

describe('chooseTake', () => {
  it('nimmt den ersten sauberen Take', () => {
    expect(chooseTake([take(2), take(1), take(1)]).index).toBe(1)
  })
  it('fällt auf Take 1 zurück', () => {
    const choice = chooseTake([take(2), take(3)])
    expect(choice.index).toBe(0)
    expect(choice.reason).toContain('kein Take')
  })
  it('respektiert eine manuelle Vorgabe', () => {
    expect(chooseTake([take(1), take(1), take(2)], 3).index).toBe(2)
    expect(() => chooseTake([take(1)], 2)).toThrow('Take 2 gibt es nicht')
  })
})
```

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tools`
Expected: FAIL mit `Failed to resolve import "./analyze"` (bzw. `./elevenlabs`, `./takes`).

- [ ] **Step 4: Implementierung**

`tools/lib/analyze.ts`:

```ts
import { fadeOut, normalizePeak, toDb } from '../../src/audio/dsp/level'
import { detectOnsets } from '../../src/audio/onset/detector'

/** Index des ersten Samples, ab dem das 5-ms-RMS (1-ms-Schritte) über `thresholdDb` liegt, sonst -1. */
export function firstAbove(samples: Float32Array, sampleRate: number, thresholdDb: number): number {
  const win = Math.max(1, Math.round(sampleRate * 0.005))
  const step = Math.max(1, Math.round(sampleRate * 0.001))
  for (let i = 0; i + win <= samples.length; i += step) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j]
    if (toDb(Math.sqrt(sum / win)) > thresholdDb) return i
  }
  return -1
}

/** Index nach dem letzten 5-ms-Fenster über `thresholdDb`, sonst -1. */
export function lastAbove(samples: Float32Array, sampleRate: number, thresholdDb: number): number {
  const win = Math.max(1, Math.round(sampleRate * 0.005))
  const step = Math.max(1, Math.round(sampleRate * 0.001))
  for (let i = samples.length - win; i >= 0; i -= step) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j]
    if (toDb(Math.sqrt(sum / win)) > thresholdDb) return i + win
  }
  return -1
}

/** Einsätze, die der Detektor in einem isolierten Klang findet (mit Stille davor und danach). */
export function isolatedOnsets(samples: Float32Array, sampleRate: number): number[] {
  const lead = Math.round(0.2 * sampleRate)
  const padded = new Float32Array(lead + samples.length + Math.round(0.3 * sampleRate))
  padded.set(samples, lead)
  // Sehr leises Dither, damit die Stille nicht digital null ist.
  for (let i = 0; i < padded.length; i++) padded[i] += (((i * 7919) % 2000) / 1000 - 1) * 1e-4
  return detectOnsets(padded, sampleRate).map((o) => o.time - lead / sampleRate)
}

export type PreparedSyllable = {
  samples: Float32Array
  /** Wahrgenommener Einsatz ab Dateibeginn (Sekunden). */
  refSeconds: number
  /** Anzahl erkannter Einsätze im fertigen Sample. 1 = sauber. */
  onsetCount: number
}

export type SyllableOptions = { peakDb: number; tailSeconds?: number; fadeMs?: number; preRollMs?: number }

/**
 * Bereitet eine gesprochene Silbe auf: Stille vorne weg (Schwelle -45 dBFS, 2 ms Vorlauf),
 * Ende bei Einsatz + `tailSeconds` (Standard 130 ms) mit Ausblenden, Spitzenpegel `peakDb`.
 */
export function prepareSyllable(raw: Float32Array, sampleRate: number, opts: SyllableOptions): PreparedSyllable {
  const { peakDb, tailSeconds = 0.13, fadeMs = 30, preRollMs = 2 } = opts
  const first = firstAbove(raw, sampleRate, -45)
  if (first < 0) throw new Error('Silbe ist zu leise (nichts über -45 dBFS)')
  const start = Math.max(0, first - Math.round((sampleRate * preRollMs) / 1000))
  const trimmed = raw.subarray(start)
  const onsets = isolatedOnsets(trimmed, sampleRate)
  if (onsets.length === 0) throw new Error('Kein Einsatz in der Silbe gefunden')
  const ref = onsets[0]
  const end = Math.min(trimmed.length, Math.round((ref + tailSeconds) * sampleRate))
  const shaped = normalizePeak(fadeOut(trimmed.slice(0, end), sampleRate, fadeMs), peakDb)
  return { samples: shaped, refSeconds: ref, onsetCount: isolatedOnsets(shaped, sampleRate).length }
}

/** Bereitet einen UI-Sound auf: Stille vorne und hinten weg (-50 dBFS), max. Länge, Ausblenden, Pegel. */
export function prepareUiSound(raw: Float32Array, sampleRate: number, peakDb: number, maxSeconds: number): Float32Array {
  const first = firstAbove(raw, sampleRate, -50)
  const last = lastAbove(raw, sampleRate, -50)
  if (first < 0 || last <= first) throw new Error('UI-Sound ist zu leise')
  const end = Math.min(last + Math.round(0.02 * sampleRate), first + Math.round(maxSeconds * sampleRate), raw.length)
  return normalizePeak(fadeOut(raw.slice(first, end), sampleRate, 50), peakDb)
}
```

`tools/lib/elevenlabs.ts`:

```ts
import { pcm16ToFloat } from '../../src/audio/dsp/wav'

/** Rohes PCM mit 24 kHz ist in allen ElevenLabs-Abos verfügbar (44,1 kHz erst ab Pro). */
export const OUTPUT_FORMAT = 'pcm_24000'
export const OUTPUT_SAMPLE_RATE = 24000
const BASE_URL = 'https://api.elevenlabs.io'

export type Voice = { voice_id: string; name: string; category: string; labels: Record<string, string> }

export type TtsOptions = {
  modelId: string
  seed?: number
  voiceSettings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class ElevenLabsClient {
  private readonly apiKey: string
  private readonly fetchFn: FetchLike

  constructor(apiKey: string, fetchFn: FetchLike = fetch) {
    if (!apiKey) throw new Error('ELEVENLABS_API fehlt. Trage den Key in .env ein (siehe .env.example).')
    this.apiKey = apiKey
    this.fetchFn = fetchFn
  }

  async listVoices(category = 'premade'): Promise<Voice[]> {
    const res = await this.request(`/v2/voices?page_size=100&category=${encodeURIComponent(category)}`, { method: 'GET' })
    const body = (await res.json()) as { voices: Voice[] }
    return body.voices
  }

  /** Text-to-Speech, Ergebnis als Float32 mit 24 kHz. */
  async tts(voiceId: string, text: string, opts: TtsOptions): Promise<Float32Array> {
    const res = await this.request(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        model_id: opts.modelId,
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts.voiceSettings ? { voice_settings: opts.voiceSettings } : {}),
      }),
    })
    return pcm16ToFloat(new Uint8Array(await res.arrayBuffer()))
  }

  /** Sound-Effekt aus einer Beschreibung, Ergebnis als Float32 mit 24 kHz. */
  async soundEffect(prompt: string, durationSeconds: number): Promise<Float32Array> {
    const res = await this.request(`/v1/sound-generation?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds, prompt_influence: 0.6 }),
    })
    return pcm16ToFloat(new Uint8Array(await res.arrayBuffer()))
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchFn(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`ElevenLabs ${init.method ?? 'GET'} ${path} fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`)
    }
    return res
  }
}
```

`tools/lib/takes.ts`:

```ts
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
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run tools`
Expected: 14 Tests PASS.

- [ ] **Step 6: Konfiguration und CLI**

`tools/sounds.config.json` (`voiceId` bleibt leer, bis Luca gewählt hat; Silbentexte sind phonetisch geschrieben, damit englische Stimmen sie richtig sprechen):

`tools/sounds.config.json`:

```json
{
  "voiceId": "",
  "modelId": "eleven_multilingual_v2",
  "takes": 3,
  "auditionVoiceIds": [
    "SAz9YHcvj6GT2YYXdXww",
    "Xb7hH8MSUJpSbSDYk0k2",
    "onwK4e9ZLuTAKqWW03F9",
    "iP95p4xoKVk53GoZ742B"
  ],
  "auditionText": "Tah kee tah. Tah kah dee mee. Tah dee ghee nah tom.",
  "syllables": {
    "ta": { "normal": "Tah.", "accent": "TAH!" },
    "ka": { "normal": "Kah.", "accent": "KAH!" },
    "ki": { "normal": "Kee.", "accent": "KEE!" },
    "di": { "normal": "Dee.", "accent": "DEE!" },
    "mi": { "normal": "Mee.", "accent": "MEE!" },
    "gi": { "normal": "Ghee.", "accent": "GHEE!" },
    "na": { "normal": "Nah.", "accent": "NAH!" },
    "thom": { "normal": "Tom.", "accent": "TOM!" }
  },
  "count": { "eins": "Eins!", "zwei": "Zwei!", "drei": "Drei!", "vier": "Vier!" },
  "ui": {
    "correct": { "prompt": "short bright two-note rising marimba chime, clean, dry, no reverb", "seconds": 0.7 },
    "miss": { "prompt": "single soft low wooden knock, short and muted, dry", "seconds": 0.5 },
    "lessonComplete": { "prompt": "short cheerful marimba arpeggio flourish ending on a bright chord, dry", "seconds": 1.5 },
    "streak": { "prompt": "warm short whoosh with a small sparkling shimmer at the end", "seconds": 1.0 }
  },
  "levels": { "normalPeakDb": -7, "accentPeakDb": -1, "countPeakDb": -4, "uiPeakDb": -6 },
  "takeOverrides": {}
}
```

`tools/generate-sounds.ts`:

```ts
/**
 * Erzeugt die Sounds der App mit ElevenLabs.
 *
 *   npm run sounds -- voices   Hörproben der Kandidaten-Stimmen nach tools/.audition/
 *   npm run sounds -- build    Alle Silben, Einzählwörter und UI-Sounds nach public/sounds/
 *
 * Liest ELEVENLABS_API aus der Umgebung oder aus .env.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizePeak } from '../src/audio/dsp/level'
import { encodeWav16 } from '../src/audio/dsp/wav'
import { COUNT_WORDS, UI_SOUNDS, type CountWord, type SoundManifest, type SoundRef, type UiSound } from '../src/audio/manifest'
import { SYLLABLES } from '../src/content/syllables'
import type { SyllableId } from '../src/domain/types'
import { prepareSyllable, prepareUiSound, type PreparedSyllable } from './lib/analyze'
import { ElevenLabsClient, OUTPUT_SAMPLE_RATE } from './lib/elevenlabs'
import { chooseTake } from './lib/takes'

type Config = {
  voiceId: string
  modelId: string
  takes: number
  auditionVoiceIds: string[]
  auditionText: string
  syllables: Record<SyllableId, { normal: string; accent: string }>
  count: Record<CountWord, string>
  ui: Record<UiSound, { prompt: string; seconds: number }>
  levels: { normalPeakDb: number; accentPeakDb: number; countPeakDb: number; uiPeakDb: number }
  takeOverrides: Record<string, number>
}

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'sounds')
const AUDITION_DIR = path.join(ROOT, 'tools', '.audition')

async function loadConfig(): Promise<Config> {
  return JSON.parse(await readFile(path.join(ROOT, 'tools', 'sounds.config.json'), 'utf8')) as Config
}

function client(): ElevenLabsClient {
  const envFile = path.join(ROOT, '.env')
  if (!process.env.ELEVENLABS_API && existsSync(envFile)) process.loadEnvFile(envFile)
  return new ElevenLabsClient(process.env.ELEVENLABS_API ?? '')
}

async function writeWav(file: string, samples: Float32Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, encodeWav16(samples, OUTPUT_SAMPLE_RATE))
}

function soundRef(file: string, samples: Float32Array, refSeconds: number): SoundRef {
  return { file, refSeconds: Number(refSeconds.toFixed(4)), durationSeconds: Number((samples.length / OUTPUT_SAMPLE_RATE).toFixed(4)) }
}

async function voices(config: Config): Promise<void> {
  const api = client()
  const all = await api.listVoices('premade')
  console.log('Verfügbare Standard-Stimmen:')
  for (const v of all) console.log(`  ${v.voice_id}  ${v.name}  (${Object.values(v.labels).join(', ')})`)
  for (const id of config.auditionVoiceIds) {
    const name = all.find((v) => v.voice_id === id)?.name.split(' ')[0] ?? 'stimme'
    const samples = normalizePeak(await api.tts(id, config.auditionText, { modelId: config.modelId }), -3)
    const file = path.join(AUDITION_DIR, `voice-${name.toLowerCase()}-${id}.wav`)
    await writeWav(file, samples)
    console.log(`Hörprobe: ${path.relative(ROOT, file)}`)
  }
  console.log('\nHöre die Proben an, trage die gewählte voiceId in tools/sounds.config.json ein und starte dann "build".')
}

async function renderSyllable(api: ElevenLabsClient, config: Config, key: string, text: string, peakDb: number): Promise<PreparedSyllable> {
  const takes: PreparedSyllable[] = []
  for (let take = 1; take <= config.takes; take++) {
    const raw = await api.tts(config.voiceId, text, { modelId: config.modelId, seed: take })
    const prepared = prepareSyllable(raw, OUTPUT_SAMPLE_RATE, { peakDb })
    takes.push(prepared)
    await writeWav(path.join(AUDITION_DIR, 'takes', `${key}-${take}.wav`), prepared.samples)
  }
  const choice = chooseTake(takes, config.takeOverrides[key])
  const chosen = takes[choice.index]
  console.log(`  ${key.padEnd(12)} Take ${choice.index + 1} (${choice.reason}), Einsatz ${(chosen.refSeconds * 1000).toFixed(1)} ms`)
  return chosen
}

async function build(config: Config): Promise<void> {
  if (!config.voiceId) throw new Error('voiceId in tools/sounds.config.json ist leer. Zuerst "voices" ausführen und eine Stimme wählen.')
  const api = client()
  const syllables = {} as SoundManifest['syllables']
  const count = {} as SoundManifest['count']
  const ui = {} as SoundManifest['ui']

  console.log('Silben:')
  for (const syl of SYLLABLES) {
    const texts = config.syllables[syl]
    const normal = await renderSyllable(api, config, `${syl}.normal`, texts.normal, config.levels.normalPeakDb)
    const accent = await renderSyllable(api, config, `${syl}.accent`, texts.accent, config.levels.accentPeakDb)
    await writeWav(path.join(OUT_DIR, `syl-${syl}.wav`), normal.samples)
    await writeWav(path.join(OUT_DIR, `syl-${syl}-accent.wav`), accent.samples)
    syllables[syl] = {
      normal: soundRef(`syl-${syl}.wav`, normal.samples, normal.refSeconds),
      accent: soundRef(`syl-${syl}-accent.wav`, accent.samples, accent.refSeconds),
    }
  }

  console.log('Einzählen:')
  for (const word of COUNT_WORDS) {
    const prepared = await renderSyllable(api, config, `count.${word}`, config.count[word], config.levels.countPeakDb)
    await writeWav(path.join(OUT_DIR, `count-${word}.wav`), prepared.samples)
    count[word] = soundRef(`count-${word}.wav`, prepared.samples, prepared.refSeconds)
  }

  console.log('UI-Sounds:')
  for (const name of UI_SOUNDS) {
    const spec = config.ui[name]
    const raw = await api.soundEffect(spec.prompt, Math.max(0.5, spec.seconds))
    const samples = prepareUiSound(raw, OUTPUT_SAMPLE_RATE, config.levels.uiPeakDb, spec.seconds + 0.2)
    await writeWav(path.join(OUT_DIR, `ui-${name}.wav`), samples)
    ui[name] = soundRef(`ui-${name}.wav`, samples, 0)
    console.log(`  ${name}`)
  }

  const manifest: SoundManifest = {
    version: 1,
    sampleRate: OUTPUT_SAMPLE_RATE,
    voiceId: config.voiceId,
    modelId: config.modelId,
    generatedAt: new Date().toISOString(),
    syllables,
    count,
    ui,
  }
  await writeFile(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\nFertig: ${path.relative(ROOT, OUT_DIR)}/manifest.json. Einzelne Takes zum Anhören liegen in tools/.audition/takes/.`)
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const config = await loadConfig()
  if (command === 'voices') await voices(config)
  else if (command === 'build') await build(config)
  else {
    console.error('Aufruf: npm run sounds -- voices | build')
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
```

`docker-compose.yml` ersetzen:

`docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped

  # Sound-Generierung mit ElevenLabs (nur bei Bedarf):
  #   docker compose run --rm sounds voices
  #   docker compose run --rm sounds build
  sounds:
    profiles: ["tools"]
    image: node:22-alpine
    working_dir: /app
    env_file: .env
    volumes:
      - .:/app
      - /app/node_modules
    entrypoint: ["sh", "-c", "npm ci --no-audit --no-fund && npx tsx tools/generate-sounds.ts \"$$@\"", "--"]
    command: ["build"]
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: keine Ausgabe.

- [ ] **Step 8: Hörproben erzeugen**

Voraussetzung: `.env` mit `ELEVENLABS_API` (liegt bei Luca bereits vor).

Run: `npm run sounds -- voices`
Expected: Liste der Standard-Stimmen, danach vier Zeilen `Hörprobe: tools/.audition/voice-<name>-<id>.wav`.

- [ ] **Step 9: CHECKPOINT Luca: Stimme wählen**

Luca hört die vier Proben an (z. B. `open tools/.audition`) und nennt die gewünschte Stimme. Ihre ID kommt in `tools/sounds.config.json` unter `voiceId`. Klingen Silben falsch (z. B. "Dee" als "Die"), werden die Texte unter `syllables` angepasst. **Nicht ohne Lucas Wahl weitermachen.**

- [ ] **Step 10: Sounds erzeugen**

Run: `npm run sounds -- build`
Expected: Pro Silbe zwei Zeilen wie `ta.normal    Take 2 (erster Take mit genau einem Einsatz), Einsatz 50.7 ms`, danach Einzählen und UI-Sounds, zum Schluss `Fertig: public/sounds/manifest.json`. Erscheint bei einer Silbe "kein Take mit genau einem Einsatz", Luca die Takes in `tools/.audition/takes/` anhören lassen und bei Bedarf in `takeOverrides` einen Take festlegen (z. B. `"ta.normal": 3`), dann erneut `build`.

- [ ] **Step 11: Test mit den echten Samples hinzufügen und laufen lassen**

`src/audio/onset/realSamples.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORDS } from '../../content/syllables'
import { median } from '../../domain/stats'
import type { Division } from '../../domain/types'
import { decodeWav } from '../dsp/wav'
import type { SoundManifest } from '../manifest'
import { detectOnsets, minIoiForGrid } from './detector'
import { addNoise, matchStats, placeSyllables } from './testSignals'

/**
 * Baut Folgen aus den echten ElevenLabs-Samples (public/sounds) und prüft die Erkennung.
 * Läuft nur, wenn die Sounds generiert sind.
 */
const SOUNDS = path.resolve(import.meta.dirname, '../../../public/sounds')
const manifestPath = path.join(SOUNDS, 'manifest.json')
const hasSounds = existsSync(manifestPath)

function load(file: string): { samples: Float32Array; sampleRate: number } {
  return decodeWav(new Uint8Array(readFileSync(path.join(SOUNDS, file))))
}

describe.skipIf(!hasSounds)('Erkennung mit echten Silben-Samples', () => {
  const manifest = hasSounds ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as SoundManifest) : null

  const cases: { div: Division; bpm: number }[] = [
    { div: 2, bpm: 120 },
    { div: 3, bpm: 100 },
    { div: 4, bpm: 120 },
    { div: 5, bpm: 80 },
    { div: 7, bpm: 80 },
  ]

  for (const { div, bpm } of cases) {
    it(`${WORDS[div].join('-')} bei ${bpm} BPM: Median-Fehler < 10 ms, >= 95 % erkannt, <= 3 % zu viel`, () => {
      if (!manifest) return
      const words = WORDS[div]
      const loaded = words.map((syl) => load(manifest.syllables[syl].normal.file))
      const sampleRate = loaded[0].sampleRate
      const refs = words.map((syl) => manifest.syllables[syl].normal.refSeconds)
      const step = 60 / bpm / div
      const count = div * 8
      const targets = Array.from({ length: count }, (_, k) => 0.4 + k * step)
      const signal = placeSyllables(sampleRate, targets, loaded.map((l) => l.samples), refs, 0.4 + count * step + 0.6)
      addNoise(signal, -55, 11)
      const onsets = detectOnsets(signal, sampleRate, { minIoiSeconds: minIoiForGrid(step) })
      const stats = matchStats(targets, onsets.map((o) => o.time), step)
      expect(stats.matched / count).toBeGreaterThanOrEqual(0.95)
      expect(stats.extras / count).toBeLessThanOrEqual(0.03)
      expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.01)
    })
  }
})
```

Run: `npx vitest run src/audio/onset/realSamples.test.ts`
Expected: 5 Tests PASS (Ta-ka, Ta-ki-ta, Ta-ka-di-mi, 5er, 7er).

- [ ] **Step 12: Sounds im Container prüfen**

Run:

```bash
docker compose up --build -d
curl -s -o /dev/null -D - localhost:8080/sounds/syl-ta.wav | grep -iE "^(HTTP|content-type)"
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" localhost:8080/sounds/manifest.json
docker compose down
```

Expected: `HTTP/1.1 200 OK`, `Content-Type: audio/wav`, `200 application/json`.

- [ ] **Step 13: Commit**

```bash
git add src/audio/manifest.ts src/audio/onset/realSamples.test.ts tools docker-compose.yml public/sounds
git commit -m "feat: Sound-Werkzeug für ElevenLabs und generierte Silben" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 7: Zeitplan und Scheduler

**Files:**
- Create: `src/audio/timeline.ts`, `src/audio/scheduler.ts`
- Test: `src/audio/timeline.test.ts`, `src/audio/scheduler.test.ts`

**Interfaces:**
- Consumes: `beatDuration`, `expectedEvents`, `patternDuration` (Task 3), `COUNT_WORDS` (Task 6)
- Produces:
  - `type TimelineEvent` (`click` | `count` | `syllable` mit `loop`, `index`, `gain`), `type TimelineOptions = { pattern; bpm; startTime; countInBars: 0 | 1; loops: number | null; click; voice; voiceGains? }`
  - `firstLoopTime(opts)`, `loopStartTime(opts, loop)`, `timelineEnd(opts): number | null`, `timelineEvents(opts, from, to): TimelineEvent[]` (halboffen `[from, to)`, sortiert)
  - `type Clock = { readonly currentTime: number }`, `class Scheduler(clock, source, play, { lookaheadSeconds = 0.1, intervalMs = 25 })` mit `start(fromTime)`, `stop()`, `tick()`, `running`

- [ ] **Step 1: Tests schreiben**

`src/audio/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { wordBeat } from '../content/syllables'
import type { Pattern } from '../domain/types'
import { firstLoopTime, loopStartTime, timelineEnd, timelineEvents, type TimelineOptions } from './timeline'

const taka: Pattern = { id: 'taka', title: 'Ta-ka', beats: [1, 2, 3, 4].map(() => wordBeat(2, true)) }
const base: TimelineOptions = { pattern: taka, bpm: 60, startTime: 10, countInBars: 1, loops: 2, click: true, voice: true }

describe('timeline', () => {
  it('beginnt nach einem Einzähltakt', () => {
    expect(firstLoopTime(base)).toBe(14)
    expect(loopStartTime(base, 1)).toBe(18)
    expect(timelineEnd(base)).toBe(22)
    expect(timelineEnd({ ...base, loops: null })).toBeNull()
  })

  it('zählt mit Klick und Wörtern ein', () => {
    const events = timelineEvents(base, 10, 14)
    expect(events.filter((e) => e.kind === 'count').map((e) => e.kind === 'count' && e.word)).toEqual(['eins', 'zwei', 'drei', 'vier'])
    expect(events.filter((e) => e.kind === 'click').map((e) => e.kind === 'click' && e.accent)).toEqual([true, false, false, false])
    expect(events.some((e) => e.kind === 'syllable')).toBe(false)
  })

  it('liefert Silben und Klicks pro Durchgang', () => {
    const events = timelineEvents(base, 14, 22)
    const syllables = events.filter((e) => e.kind === 'syllable')
    expect(syllables).toHaveLength(16)
    expect(syllables[0]).toMatchObject({ time: 14, syl: 'ta', accent: true, loop: 0, index: 0 })
    expect(syllables[9]).toMatchObject({ time: 18.5, syl: 'ka', loop: 1, index: 1 })
    expect(events.filter((e) => e.kind === 'click')).toHaveLength(8)
  })

  it('liefert jedes Ereignis bei aneinandergereihten Fenstern genau einmal', () => {
    const all = timelineEvents(base, 0, 100)
    const pieces = [0, 3.3, 7.1, 14, 14.01, 17.999, 22, 100]
    const stitched = pieces.slice(1).flatMap((to, i) => timelineEvents(base, pieces[i], to))
    expect(stitched).toEqual(all)
    expect(all).toHaveLength(4 + 4 + 8 + 16)
  })

  it('läuft endlos weiter, wenn loops null ist', () => {
    const events = timelineEvents({ ...base, loops: null }, 1000, 1004)
    expect(events.filter((e) => e.kind === 'syllable')).toHaveLength(8)
  })

  it('setzt die Stimmlautstärke pro Durchgang', () => {
    const events = timelineEvents({ ...base, loops: 4, voiceGains: [1, 0.6, 0.25, 0] }, 14, 30)
    const gains = events.flatMap((e) => (e.kind === 'syllable' && e.index === 0 ? [e.gain] : []))
    expect(gains).toEqual([1, 0.6, 0.25, 0])
  })

  it('lässt Klick oder Stimme weg, wenn abgeschaltet', () => {
    expect(timelineEvents({ ...base, click: false }, 14, 18).every((e) => e.kind === 'syllable')).toBe(true)
    expect(timelineEvents({ ...base, voice: false }, 14, 18).every((e) => e.kind === 'click')).toBe(true)
  })
})
```

`src/audio/scheduler.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scheduler } from './scheduler'
import type { TimelineEvent } from './timeline'

const clicks = (from: number, to: number): TimelineEvent[] => {
  const out: TimelineEvent[] = []
  for (let t = Math.ceil(from * 4) / 4; t < to; t += 0.25) out.push({ kind: 'click', time: t, accent: false })
  return out
}

describe('Scheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('plant jedes Ereignis genau einmal und rechtzeitig', () => {
    const clock = { currentTime: 0 }
    const played: TimelineEvent[] = []
    const scheduler = new Scheduler(clock, clicks, (e) => played.push(e))
    scheduler.start(0)
    for (let i = 0; i < 80; i++) {
      clock.currentTime += 0.025
      vi.advanceTimersByTime(25)
      for (const e of played) expect(e.time).toBeGreaterThanOrEqual(0)
      expect(played.at(-1)?.time ?? 0).toBeGreaterThan(clock.currentTime - 0.25)
    }
    const times = played.map((e) => e.time)
    expect(new Set(times).size).toBe(times.length)
    expect(times.slice(0, 4)).toEqual([0, 0.25, 0.5, 0.75])
    expect(times.at(-1)).toBeGreaterThanOrEqual(2)
  })

  it('plant nach stop nichts mehr', () => {
    const clock = { currentTime: 0 }
    const play = vi.fn()
    const scheduler = new Scheduler(clock, clicks, play)
    scheduler.start(0)
    scheduler.stop()
    const count = play.mock.calls.length
    clock.currentTime = 5
    vi.advanceTimersByTime(500)
    expect(play.mock.calls.length).toBe(count)
    expect(scheduler.running).toBe(false)
  })
})
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/audio/timeline.test.ts src/audio/scheduler.test.ts`
Expected: FAIL mit `Failed to resolve import "./timeline"` bzw. `"./scheduler"`.

- [ ] **Step 3: Implementierung**

`src/audio/timeline.ts`:

```ts
import { beatDuration, expectedEvents, patternDuration } from '../domain/pattern'
import type { Pattern, SyllableId } from '../domain/types'
import { COUNT_WORDS, type CountWord } from './manifest'

export type TimelineEvent =
  | { kind: 'click'; time: number; accent: boolean }
  | { kind: 'count'; time: number; word: CountWord }
  | { kind: 'syllable'; time: number; syl: SyllableId; accent: boolean; loop: number; index: number; gain: number }

export type TimelineOptions = {
  pattern: Pattern
  bpm: number
  /** Audio-Zeit, zu der der erste Schlag (Einzählen oder Durchgang 1) erklingt. */
  startTime: number
  countInBars: 0 | 1
  /** Anzahl Durchgänge, `null` = endlos. */
  loops: number | null
  click: boolean
  voice: boolean
  /** Stimmlautstärke pro Durchgang (0..1). Der letzte Wert gilt für alle weiteren. Standard: 1. */
  voiceGains?: number[]
}

export function firstLoopTime(opts: TimelineOptions): number {
  return opts.startTime + opts.countInBars * 4 * beatDuration(opts.bpm)
}

export function loopStartTime(opts: TimelineOptions, loop: number): number {
  return firstLoopTime(opts) + loop * patternDuration(opts.pattern, opts.bpm)
}

/** Ende des letzten Durchgangs, `null` bei endlos. */
export function timelineEnd(opts: TimelineOptions): number | null {
  return opts.loops === null ? null : loopStartTime(opts, opts.loops)
}

function voiceGain(opts: TimelineOptions, loop: number): number {
  const gains = opts.voiceGains
  if (!gains || gains.length === 0) return 1
  return gains[Math.min(loop, gains.length - 1)]
}

/** Alle Ereignisse mit `from <= time < to`, zeitlich sortiert. */
export function timelineEvents(opts: TimelineOptions, from: number, to: number): TimelineEvent[] {
  const bd = beatDuration(opts.bpm)
  const events: TimelineEvent[] = []
  const inRange = (t: number) => t >= from && t < to

  for (let b = 0; b < opts.countInBars * 4; b++) {
    const t = opts.startTime + b * bd
    if (!inRange(t)) continue
    if (opts.click) events.push({ kind: 'click', time: t, accent: b % 4 === 0 })
    events.push({ kind: 'count', time: t, word: COUNT_WORDS[b % 4] })
  }

  const loopDur = patternDuration(opts.pattern, opts.bpm)
  const first = firstLoopTime(opts)
  const lastLoop = opts.loops === null ? Number.POSITIVE_INFINITY : opts.loops - 1
  const fromLoop = Math.max(0, Math.floor((from - first) / loopDur))
  const toLoop = Math.min(lastLoop, Math.floor((to - first) / loopDur))
  for (let loop = fromLoop; loop <= toLoop; loop++) {
    const loopStart = first + loop * loopDur
    if (opts.click) {
      opts.pattern.beats.forEach((_, b) => {
        const t = loopStart + b * bd
        if (inRange(t)) events.push({ kind: 'click', time: t, accent: b % 4 === 0 })
      })
    }
    if (opts.voice) {
      const gain = voiceGain(opts, loop)
      expectedEvents(opts.pattern, opts.bpm, loopStart).forEach((e, index) => {
        if (inRange(e.t)) events.push({ kind: 'syllable', time: e.t, syl: e.syl, accent: e.accent, loop, index, gain })
      })
    }
  }
  return events.sort((a, b) => a.time - b.time)
}
```

`src/audio/scheduler.ts`:

```ts
import type { TimelineEvent } from './timeline'

export type Clock = { readonly currentTime: number }

/**
 * Lookahead-Scheduler: Alle `intervalMs` werden die Ereignisse bis `currentTime + lookahead`
 * geholt und sample-genau eingeplant. JavaScript-Timer bestimmen nur, wann geplant wird,
 * nie, wann es klingt.
 */
export class Scheduler {
  private readonly clock: Clock
  private readonly source: (from: number, to: number) => TimelineEvent[]
  private readonly play: (event: TimelineEvent) => void
  private readonly lookahead: number
  private readonly intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private scheduledUntil = 0

  constructor(
    clock: Clock,
    source: (from: number, to: number) => TimelineEvent[],
    play: (event: TimelineEvent) => void,
    opts: { lookaheadSeconds?: number; intervalMs?: number } = {},
  ) {
    this.clock = clock
    this.source = source
    this.play = play
    this.lookahead = opts.lookaheadSeconds ?? 0.1
    this.intervalMs = opts.intervalMs ?? 25
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(fromTime: number): void {
    this.stop()
    this.scheduledUntil = fromTime
    this.tick()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  tick(): void {
    const to = this.clock.currentTime + this.lookahead
    if (to <= this.scheduledUntil) return
    for (const event of this.source(this.scheduledUntil, to)) this.play(event)
    this.scheduledUntil = to
  }
}
```

- [ ] **Step 4: Tests und Typecheck**

Run: `npx vitest run src/audio/timeline.test.ts src/audio/scheduler.test.ts && npm run typecheck`
Expected: 9 Tests PASS, keine Typfehler.

- [ ] **Step 5: Commit**

```bash
git add src/audio/timeline.ts src/audio/timeline.test.ts src/audio/scheduler.ts src/audio/scheduler.test.ts
git commit -m "feat: Zeitplan und Lookahead-Scheduler" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 8: Wiedergabe-Engine mit Browser-Test

**Files:**
- Create: `src/audio/sampleBank.ts`, `src/audio/engine.ts`, `playwright.config.ts`
- Test: `tests/e2e/engine.spec.ts`
- Modify: `package.json` (Script `test:e2e`, Dev-Abhängigkeit `@playwright/test`)

**Interfaces:**
- Consumes: `Scheduler` (Task 7), `timelineEvents`, `firstLoopTime`, `timelineEnd`, `TimelineOptions` (Task 7), `SoundManifest`, `CountWord`, `UiSound` (Task 6)
- Produces:
  - `type Sample = { buffer: AudioBuffer; refSeconds }`, `type SampleBank = { manifest; syllable(syl, accent): Sample; count(word): Sample; ui(name): AudioBuffer }`, `loadSampleBank(ctx, baseUrl = '/sounds/'): Promise<SampleBank>`
  - `type PlaybackOptions = Omit<TimelineOptions, 'startTime'>`, `type Playback = { startTime; firstLoopTime; endTime: number | null; options: TimelineOptions }`
  - `class AudioEngine(ctx, bank)` mit `start(options, leadSeconds = 0.2): Playback`, `stop()`, `playUi(name)`, `audibleTime(): number`, `playback`, `onEvent`

Verhalten: Silben starten um `refSeconds` früher, damit ihr Einsatzpunkt auf dem Raster liegt. Jede Silbe schneidet die vorherige ab (5 ms Ausblenden). Klick: Sinus 1000 Hz, betont 1600 Hz, 30 ms Abklingen.

- [ ] **Step 1: Playwright installieren**

```bash
npm install --no-audit --no-fund -D @playwright/test@^1.63
npx playwright install chromium
```

In `package.json` unter `scripts` ergänzen: `"test:e2e": "playwright test"`.

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5180',
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npx vite --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 2: Browser-Test schreiben**

`tests/e2e/engine.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

/** Lädt alle Sounds und spielt einen Takt Ta-ka-di-mi mit Einzählen ab. */
test('Engine lädt die Sounds und spielt Einzählen, Klicks und Silben', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // Pfade des Vite-Dev-Servers, zur Laufzeit im Browser aufgelöst.
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { loadSampleBank } = await load('/src/audio/sampleBank.ts')
    const { AudioEngine } = await load('/src/audio/engine.ts')
    const { wordBeat } = await load('/src/content/syllables.ts')
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    const bank = await loadSampleBank(ctx)
    const engine = new AudioEngine(ctx, bank)
    const counts: Record<string, number> = {}
    engine.onEvent = (e: { kind: string }) => {
      counts[e.kind] = (counts[e.kind] ?? 0) + 1
    }
    const pattern = { id: 'tkdm', title: 'Ta-ka-di-mi', beats: [1, 2, 3, 4].map(() => wordBeat(4, true)) }
    const playback = engine.start({ pattern, bpm: 120, countInBars: 1, loops: 1, click: true, voice: true })
    await new Promise((r) => setTimeout(r, 4600))
    engine.stop()
    await ctx.close()
    return {
      counts,
      firstLoop: playback.firstLoopTime - playback.startTime,
      end: (playback.endTime ?? 0) - playback.startTime,
      refTa: bank.syllable('ta', false).refSeconds,
    }
  })
  expect(result.counts).toEqual({ click: 8, count: 4, syllable: 16 })
  expect(result.firstLoop).toBeCloseTo(2)
  expect(result.end).toBeCloseTo(4)
  expect(result.refTa).toBeGreaterThan(0)
})
```

- [ ] **Step 3: Test laufen lassen, er muss fehlschlagen**

Run: `npm run test:e2e -- engine`
Expected: FAIL, im Browser-Fehler `Failed to fetch dynamically imported module` für `/src/audio/sampleBank.ts`.

- [ ] **Step 4: Implementierung**

`src/audio/sampleBank.ts`:

```ts
import type { SyllableId } from '../domain/types'
import { COUNT_WORDS, UI_SOUNDS, type CountWord, type SoundManifest, type SoundRef, type UiSound } from './manifest'

export type Sample = { buffer: AudioBuffer; refSeconds: number }

export type SampleBank = {
  manifest: SoundManifest
  syllable(syl: SyllableId, accent: boolean): Sample
  count(word: CountWord): Sample
  ui(name: UiSound): AudioBuffer
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sound konnte nicht geladen werden: ${url} (${res.status})`)
  return res
}

/** Lädt Manifest und alle WAVs und dekodiert sie für den gegebenen AudioContext. */
export async function loadSampleBank(ctx: BaseAudioContext, baseUrl = '/sounds/'): Promise<SampleBank> {
  const manifest = (await (await fetchOk(`${baseUrl}manifest.json`)).json()) as SoundManifest
  const decode = async (ref: SoundRef): Promise<Sample> => {
    const data = await (await fetchOk(`${baseUrl}${ref.file}`)).arrayBuffer()
    return { buffer: await ctx.decodeAudioData(data), refSeconds: ref.refSeconds }
  }

  const syllables = new Map<string, Sample>()
  await Promise.all(
    Object.entries(manifest.syllables).flatMap(([syl, refs]) => [
      decode(refs.normal).then((s) => syllables.set(`${syl}:0`, s)),
      decode(refs.accent).then((s) => syllables.set(`${syl}:1`, s)),
    ]),
  )
  const counts = new Map<CountWord, Sample>()
  await Promise.all(COUNT_WORDS.map((w) => decode(manifest.count[w]).then((s) => counts.set(w, s))))
  const ui = new Map<UiSound, AudioBuffer>()
  await Promise.all(UI_SOUNDS.map((n) => decode(manifest.ui[n]).then((s) => ui.set(n, s.buffer))))

  const get = <K, V>(map: Map<K, V>, key: K): V => {
    const value = map.get(key)
    if (!value) throw new Error(`Sound fehlt im Manifest: ${String(key)}`)
    return value
  }
  return {
    manifest,
    syllable: (syl, accent) => get(syllables, `${syl}:${accent ? 1 : 0}`),
    count: (word) => get(counts, word),
    ui: (name) => get(ui, name),
  }
}
```

`src/audio/engine.ts`:

```ts
import type { UiSound } from './manifest'
import type { Sample, SampleBank } from './sampleBank'
import { Scheduler } from './scheduler'
import { firstLoopTime, timelineEnd, timelineEvents, type TimelineEvent, type TimelineOptions } from './timeline'

export type PlaybackOptions = Omit<TimelineOptions, 'startTime'>

export type Playback = {
  /** Audio-Zeit des ersten Schlags (Einzählen bzw. Durchgang 1). */
  startTime: number
  /** Audio-Zeit von Durchgang 1. */
  firstLoopTime: number
  /** Ende des letzten Durchgangs oder `null` bei endlos. */
  endTime: number | null
  options: TimelineOptions
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; level: number }

/** Spielt Klick, Einzählen und Silben sample-genau ab. */
export class AudioEngine {
  readonly ctx: AudioContext
  private readonly bank: SampleBank
  private readonly voiceBus: GainNode
  private readonly clickBus: GainNode
  private scheduler: Scheduler | null = null
  private lastVoice: Voice | null = null
  private current: Playback | null = null
  /** Wird für jedes eingeplante Ereignis aufgerufen (z. B. für Anzeigen). */
  onEvent: ((event: TimelineEvent) => void) | null = null

  constructor(ctx: AudioContext, bank: SampleBank) {
    this.ctx = ctx
    this.bank = bank
    this.voiceBus = ctx.createGain()
    this.clickBus = ctx.createGain()
    this.clickBus.gain.value = 0.7
    this.voiceBus.connect(ctx.destination)
    this.clickBus.connect(ctx.destination)
  }

  get playback(): Playback | null {
    return this.current
  }

  /** Zeit, die gerade aus den Lautsprechern kommt (für Cursor und Anzeigen). */
  audibleTime(): number {
    return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0)
  }

  start(options: PlaybackOptions, leadSeconds = 0.2): Playback {
    this.stop()
    const timeline: TimelineOptions = { ...options, startTime: this.ctx.currentTime + leadSeconds }
    this.current = {
      startTime: timeline.startTime,
      firstLoopTime: firstLoopTime(timeline),
      endTime: timelineEnd(timeline),
      options: timeline,
    }
    // Silben starten um ihren Einsatzpunkt früher, deshalb etwas weiter vorausplanen.
    this.scheduler = new Scheduler(this.ctx, (from, to) => timelineEvents(timeline, from, to), (e) => this.play(e), {
      lookaheadSeconds: 0.25,
    })
    this.scheduler.start(this.ctx.currentTime)
    return this.current
  }

  stop(): void {
    this.scheduler?.stop()
    this.scheduler = null
    this.current = null
    if (this.lastVoice) {
      const { gain, source } = this.lastVoice
      const now = this.ctx.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.01)
      source.stop(now + 0.02)
      this.lastVoice = null
    }
  }

  playUi(name: UiSound): void {
    const source = this.ctx.createBufferSource()
    source.buffer = this.bank.ui(name)
    source.connect(this.ctx.destination)
    source.start()
  }

  private play(event: TimelineEvent): void {
    if (event.kind === 'click') this.click(event.time, event.accent)
    else if (event.kind === 'count') this.voice(this.bank.count(event.word), event.time, 0.8, false)
    else if (event.gain > 0) this.voice(this.bank.syllable(event.syl, event.accent), event.time, event.gain, true)
    this.onEvent?.(event)
  }

  private click(time: number, accent: boolean): void {
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = accent ? 1600 : 1000
    const peak = accent ? 1 : 0.6
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(peak, time + 0.001)
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.03)
    osc.connect(env).connect(this.clickBus)
    osc.start(time)
    osc.stop(time + 0.04)
  }

  /** Startet ein Sample so, dass sein Einsatzpunkt auf `beatTime` liegt. Optional schneidet es die vorherige Silbe ab. */
  private voice(sample: Sample, beatTime: number, level: number, choke: boolean): void {
    const when = Math.max(beatTime - sample.refSeconds, this.ctx.currentTime)
    if (choke && this.lastVoice) {
      const prev = this.lastVoice
      prev.gain.gain.setValueAtTime(prev.level, Math.max(when - 0.005, this.ctx.currentTime))
      prev.gain.gain.linearRampToValueAtTime(0, when)
      prev.source.stop(when + 0.01)
    }
    const source = this.ctx.createBufferSource()
    source.buffer = sample.buffer
    const gain = this.ctx.createGain()
    gain.gain.value = level
    source.connect(gain).connect(this.voiceBus)
    source.start(when)
    if (choke) this.lastVoice = { source, gain, level }
  }
}
```

- [ ] **Step 5: Tests und Typecheck**

Run: `npm run test:e2e -- engine && npm run typecheck`
Expected: `1 passed`, keine Typfehler.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e/engine.spec.ts src/audio/sampleBank.ts src/audio/engine.ts
git commit -m "feat: Wiedergabe-Engine mit Klick, Einzählen und Silben" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 9: Mikrofon, Worklet und Aufnahme

**Files:**
- Create: `src/audio/onset/worklet-env.d.ts`, `src/audio/onset/messages.ts`, `src/audio/onset/onset-worklet.ts`, `src/audio/mic.ts`, `src/audio/recorder.ts`
- Test: `src/audio/onset/onset-worklet.test.ts`, `src/audio/recorder.test.ts`, `tests/e2e/worklet.spec.ts`

**Interfaces:**
- Consumes: `OnsetDetector`, `DetectorParams`, `FrameStat`, `Onset` (Task 5)
- Produces:
  - `WORKLET_NAME = 'onset-detector'`, `WORKLET_BLOCK = 2048`, `type WorkletInMessage` (`params` | `reset` | `flush`), `type WorkletOutMessage` (`block` mit `startFrame`, `samples`, `frames` | `onsets`) (`messages.ts`)
  - `class MicError` mit `kind: 'denied' | 'unavailable' | 'unsupported'`, `type MicInput = { deviceId; label; setParams; reset; flush; close }`, `openMic(ctx, onMessage): Promise<MicInput>` (`mic.ts`)
  - `class Recorder(sampleRate)` mit `push(startFrame, samples)`, `startTime: number | null`, `durationSeconds`, `toFloat32()`, `clear()` (`recorder.ts`)

Wichtig: Browser liefern für Render-Quanten ohne aktive Quelle einen leeren Eingang. Das Worklet verarbeitet solche Quanten als Stille, sonst verrutschen alle späteren Zeiten (im Prototyp gemessen: −10 ms).

- [ ] **Step 1: Worklet-Typen und Nachrichten**

`src/audio/onset/worklet-env.d.ts`:

```ts
// Globale Namen im AudioWorkletGlobalScope (nicht Teil der DOM-Typen von TypeScript).
declare const sampleRate: number
declare const currentFrame: number

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: unknown)
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare function registerProcessor(name: string, processorCtor: new (options?: unknown) => AudioWorkletProcessor): void
```

`src/audio/onset/messages.ts`:

```ts
import type { DetectorParams, FrameStat, Onset } from './detector'

export const WORKLET_NAME = 'onset-detector'

/** Grösse der Audio-Blöcke, die das Worklet an die Seite schickt (Vielfaches von 128). */
export const WORKLET_BLOCK = 2048

export type WorkletInMessage =
  | { type: 'params'; params: Partial<DetectorParams> }
  | { type: 'reset'; params?: Partial<DetectorParams> }
  | { type: 'flush' }

export type WorkletOutMessage =
  | { type: 'block'; startFrame: number; samples: Float32Array; frames: FrameStat[] }
  | { type: 'onsets'; onsets: Onset[] }
```

- [ ] **Step 2: Tests schreiben**

`src/audio/onset/onset-worklet.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Onset } from './detector'
import type { WorkletOutMessage } from './messages'
import { matchStats, placeSyllables, referencePoint, synthSyllable } from './testSignals'

/**
 * Bildet den AudioWorkletGlobalScope nach und testet den Prozessor direkt.
 * Wichtig: Browser liefern für Quanten ohne aktive Quelle einen leeren Eingang.
 */
type Port = { postMessage: (message: WorkletOutMessage) => void; onmessage: ((event: { data: unknown }) => void) | null }
type Processor = { port: Port; process(inputs: Float32Array[][]): boolean }

const SR = 48000
const scope = globalThis as unknown as Record<string, unknown>
let ProcessorCtor: new () => Processor

beforeAll(async () => {
  scope.sampleRate = SR
  scope.currentFrame = 0
  scope.AudioWorkletProcessor = class {
    port: Port = { postMessage: () => {}, onmessage: null }
  }
  scope.registerProcessor = (_name: string, ctor: new () => Processor) => {
    ProcessorCtor = ctor
  }
  await import('./onset-worklet')
})

function run(processor: Processor, quanta: (Float32Array | null)[]): void {
  let frame = 0
  for (const quantum of quanta) {
    scope.currentFrame = frame
    processor.process([quantum ? [quantum] : []])
    frame += 128
  }
}

describe('onset-worklet', () => {
  it('rechnet lückenlos weiter, auch wenn Quanten ohne Eingang kommen', () => {
    const processor = new ProcessorCtor()
    const messages: WorkletOutMessage[] = []
    processor.port.postMessage = (m) => messages.push(m)

    const syllable = synthSyllable(SR)
    const ref = referencePoint(syllable, SR)
    const step = 0.25
    const targets = [0.3, 0.55, 0.8, 1.05]
    const signal = placeSyllables(SR, targets, [syllable], [ref], 1.536) // 576 Quanten
    // Ein Quantum mit Eingang setzt den Nullpunkt, danach 1 s ohne Eingang, dann die Silben.
    const silentQuanta = 375
    const quanta: (Float32Array | null)[] = [new Float32Array(128), ...Array.from({ length: silentQuanta - 1 }, () => null)]
    for (let i = 0; i < signal.length; i += 128) quanta.push(signal.subarray(i, i + 128))
    run(processor, quanta)
    processor.port.onmessage?.({ data: { type: 'flush' } })

    const onsets: Onset[] = messages.flatMap((m) => (m.type === 'onsets' ? m.onsets : []))
    const offset = (silentQuanta * 128) / SR
    const stats = matchStats(targets.map((t) => t + offset), onsets.map((o) => o.time), step)
    expect(stats.matched).toBe(4)
    expect(Math.max(...stats.errors.map(Math.abs))).toBeLessThan(0.005)
  })

  it('schickt Audio blockweise mit Start-Frame', () => {
    const processor = new ProcessorCtor()
    const messages: WorkletOutMessage[] = []
    processor.port.postMessage = (m) => messages.push(m)
    run(processor, Array.from({ length: 32 }, () => new Float32Array(128).fill(0.01)))
    const blocks = messages.filter((m) => m.type === 'block')
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.type === 'block' && b.startFrame)).toEqual([0, 2048])
  })
})
```

`src/audio/recorder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Recorder } from './recorder'

describe('Recorder', () => {
  it('hängt zusammenhängende Blöcke aneinander', () => {
    const rec = new Recorder(1000)
    rec.push(500, Float32Array.from([1, 2]))
    rec.push(502, Float32Array.from([3]))
    expect(Array.from(rec.toFloat32())).toEqual([1, 2, 3])
    expect(rec.startTime).toBe(0.5)
    expect(rec.durationSeconds).toBe(0.003)
  })

  it('füllt Lücken mit Stille und ignoriert alte Blöcke', () => {
    const rec = new Recorder(1000)
    rec.push(0, Float32Array.from([1]))
    rec.push(3, Float32Array.from([2]))
    rec.push(1, Float32Array.from([9]))
    expect(Array.from(rec.toFloat32())).toEqual([1, 0, 0, 2])
  })

  it('lässt sich leeren', () => {
    const rec = new Recorder(1000)
    rec.push(10, Float32Array.from([1]))
    rec.clear()
    expect(rec.startTime).toBeNull()
    expect(rec.toFloat32()).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/audio/onset/onset-worklet.test.ts src/audio/recorder.test.ts`
Expected: FAIL mit `Failed to resolve import "./onset-worklet"` bzw. `"./recorder"`.

- [ ] **Step 4: Implementierung**

`src/audio/onset/onset-worklet.ts`:

```ts
import { OnsetDetector, type DetectorParams, type FrameStat } from './detector'
import { WORKLET_BLOCK, WORKLET_NAME, type WorkletInMessage, type WorkletOutMessage } from './messages'

/** Stille für Render-Quanten ohne aktiven Eingang, damit die Zeitrechnung lückenlos bleibt. */
const SILENCE = new Float32Array(128)

/**
 * Läuft im Audio-Thread: erkennt Einsätze und schickt Einsätze sofort sowie Audio und
 * Energiewerte blockweise an die Seite. Zeiten sind Frames auf der Uhr des AudioContext.
 */
class OnsetProcessor extends AudioWorkletProcessor {
  private detector = new OnsetDetector(sampleRate)
  private params: Partial<DetectorParams> = {}
  private buffer = new Float32Array(WORKLET_BLOCK)
  private fill = 0
  private bufferStart = 0
  private frames: FrameStat[] = []

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<WorkletInMessage>) => this.handle(event.data)
  }

  private send(message: WorkletOutMessage, transfer: Transferable[] = []): void {
    this.port.postMessage(message, transfer)
  }

  private handle(message: WorkletInMessage): void {
    if (message.type === 'params') {
      this.params = { ...this.params, ...message.params }
      this.detector.setParams(message.params)
    } else if (message.type === 'reset') {
      this.params = { ...this.params, ...message.params }
      this.detector = new OnsetDetector(sampleRate, this.params)
      this.fill = 0
      this.frames = []
    } else {
      const onsets = this.detector.flush()
      if (onsets.length > 0) this.send({ type: 'onsets', onsets })
    }
  }

  process(inputs: Float32Array[][]): boolean {
    // Ohne aktive Quelle liefert der Browser keinen Kanal. Diese Quanten trotzdem als Stille
    // verarbeiten, sonst verrutschen alle späteren Zeiten.
    const channel = inputs[0]?.[0] ?? SILENCE
    const { onsets, frames } = this.detector.process(channel, currentFrame)
    if (onsets.length > 0) this.send({ type: 'onsets', onsets })
    this.frames.push(...frames)
    if (this.fill === 0) this.bufferStart = currentFrame
    this.buffer.set(channel, this.fill)
    this.fill += channel.length
    if (this.fill >= WORKLET_BLOCK) {
      const samples = this.buffer
      this.send({ type: 'block', startFrame: this.bufferStart, samples, frames: this.frames }, [samples.buffer])
      this.buffer = new Float32Array(WORKLET_BLOCK)
      this.fill = 0
      this.frames = []
    }
    return true
  }
}

registerProcessor(WORKLET_NAME, OnsetProcessor)
```

`src/audio/recorder.ts`:

```ts
/** Sammelt Mikrofon-Blöcke zu einer Aufnahme. Lücken (z. B. verlorene Blöcke) werden mit Stille gefüllt. */
export class Recorder {
  readonly sampleRate: number
  private chunks: Float32Array[] = []
  private firstFrame: number | null = null
  private nextFrame = 0
  private total = 0

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate
  }

  push(startFrame: number, samples: Float32Array): void {
    if (this.firstFrame === null) {
      this.firstFrame = startFrame
      this.nextFrame = startFrame
    }
    if (startFrame < this.nextFrame) return // doppelt oder veraltet
    if (startFrame > this.nextFrame) {
      const gap = new Float32Array(startFrame - this.nextFrame)
      this.chunks.push(gap)
      this.total += gap.length
    }
    this.chunks.push(samples)
    this.total += samples.length
    this.nextFrame = startFrame + samples.length
  }

  /** Audio-Zeit des ersten Samples, `null` solange leer. */
  get startTime(): number | null {
    return this.firstFrame === null ? null : this.firstFrame / this.sampleRate
  }

  get durationSeconds(): number {
    return this.total / this.sampleRate
  }

  toFloat32(): Float32Array {
    const out = new Float32Array(this.total)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }

  clear(): void {
    this.chunks = []
    this.firstFrame = null
    this.nextFrame = 0
    this.total = 0
  }
}
```

`src/audio/mic.ts`:

```ts
import type { DetectorParams } from './onset/detector'
import { WORKLET_NAME, type WorkletInMessage, type WorkletOutMessage } from './onset/messages'
import workletUrl from './onset/onset-worklet.ts?worker&url'

export type MicErrorKind = 'denied' | 'unavailable' | 'unsupported'

export class MicError extends Error {
  readonly kind: MicErrorKind
  constructor(kind: MicErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export type MicInput = {
  deviceId: string
  label: string
  setParams(params: Partial<DetectorParams>): void
  /** Neuer Detektor (z. B. vor einer Übung). Die Zeitbasis bleibt die Audio-Uhr. */
  reset(params?: Partial<DetectorParams>): void
  /** Gibt einen zurückgehaltenen letzten Einsatz frei. */
  flush(): void
  close(): void
}

const loadedContexts = new WeakSet<BaseAudioContext>()

/**
 * Öffnet das Mikrofon ohne Echo-Unterdrückung, Rauschfilter und Pegelautomatik und hängt
 * den Einsatz-Detektor (AudioWorklet) an.
 */
export async function openMic(ctx: AudioContext, onMessage: (message: WorkletOutMessage) => void): Promise<MicInput> {
  if (!navigator.mediaDevices?.getUserMedia || !ctx.audioWorklet) {
    throw new MicError('unsupported', 'Dieser Browser unterstützt die Mikrofon-Auswertung nicht. Bitte aktuellen Chrome, Firefox oder Safari verwenden.')
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })
  } catch (error) {
    const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
    throw new MicError(
      denied ? 'denied' : 'unavailable',
      denied
        ? 'Der Mikrofon-Zugriff wurde verweigert. Erlaube ihn in den Website-Einstellungen des Browsers.'
        : 'Es wurde kein Mikrofon gefunden.',
    )
  }
  if (!loadedContexts.has(ctx)) {
    await ctx.audioWorklet.addModule(workletUrl)
    loadedContexts.add(ctx)
  }
  const source = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
    channelCountMode: 'explicit',
  })
  // Stummer Ausgang, damit der Browser das Worklet sicher verarbeitet.
  const sink = ctx.createGain()
  sink.gain.value = 0
  source.connect(node).connect(sink).connect(ctx.destination)
  node.port.onmessage = (event: MessageEvent<WorkletOutMessage>) => onMessage(event.data)
  const send = (message: WorkletInMessage) => node.port.postMessage(message)

  const track = stream.getAudioTracks()[0]
  return {
    deviceId: track.getSettings().deviceId ?? '',
    label: track.label || 'Mikrofon',
    setParams: (params) => send({ type: 'params', params }),
    reset: (params) => send({ type: 'reset', params }),
    flush: () => send({ type: 'flush' }),
    close: () => {
      source.disconnect()
      node.disconnect()
      sink.disconnect()
      node.port.onmessage = null
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}
```

- [ ] **Step 5: Unit-Tests laufen lassen**

Run: `npx vitest run src/audio/onset/onset-worklet.test.ts src/audio/recorder.test.ts`
Expected: 5 Tests PASS.

- [ ] **Step 6: Gegenprobe für die Stille-Behandlung**

In `onset-worklet.ts` die Zeile `const channel = inputs[0]?.[0] ?? SILENCE` vorübergehend ersetzen durch:

```ts
    const channel = inputs[0]?.[0]
    if (!channel) return true
```

Run: `npx vitest run src/audio/onset/onset-worklet.test.ts`
Expected: FAIL in "rechnet lückenlos weiter, auch wenn Quanten ohne Eingang kommen". Danach die Änderung rückgängig machen und erneut laufen lassen: PASS.

- [ ] **Step 7: Browser-Integrationstest**

`tests/e2e/worklet.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

/**
 * Integrationstest im echten Browser: Die echten Silben-Samples laufen (ohne Mikrofon) direkt
 * in das Onset-Worklet. Zwischen zwei Hälften liegt eine Pause ohne aktive Quelle. Geprüft
 * werden Bündelung, Nachrichten und die lückenlose Zeitbasis auf der Audio-Uhr.
 */
test('Worklet erkennt Silben zeitgenau, auch nach einer Pause ohne Eingang', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // Pfade des Vite-Dev-Servers, zur Laufzeit im Browser aufgelöst.
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { loadSampleBank } = await load('/src/audio/sampleBank.ts')
    const { default: workletUrl } = await load('/src/audio/onset/onset-worklet.ts?worker&url')
    const { WORKLET_NAME } = await load('/src/audio/onset/messages.ts')
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    const bank = await loadSampleBank(ctx)
    await ctx.audioWorklet.addModule(workletUrl)
    const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
    })
    const sink = ctx.createGain()
    sink.gain.value = 0
    node.connect(sink).connect(ctx.destination)
    const onsets: number[] = []
    node.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'onsets') onsets.push(...e.data.onsets.map((o: { time: number }) => o.time))
    }
    node.port.postMessage({ type: 'params', params: { minIoiSeconds: 0.075 } })
    const words = ['ta', 'ka', 'di', 'mi']
    const step = 0.125
    const targets: number[] = []
    const t0 = ctx.currentTime + 0.3
    for (const half of [0, 1]) {
      const start = t0 + half * (8 * step + 1.0) // 1 s Pause ohne Quelle
      for (let k = 0; k < 8; k++) {
        const sample = bank.syllable(words[k % 4], false)
        const src = ctx.createBufferSource()
        src.buffer = sample.buffer
        src.connect(node)
        targets.push(start + k * step)
        src.start(start + k * step - sample.refSeconds)
        if (k < 7) src.stop(start + (k + 1) * step - bank.syllable(words[(k + 1) % 4], false).refSeconds)
      }
    }
    await new Promise((r) => setTimeout(r, 3500))
    node.port.postMessage({ type: 'flush' })
    await new Promise((r) => setTimeout(r, 150))
    await ctx.close()
    const errors = targets.map((t) => Math.min(...onsets.map((o) => Math.abs(o - t))))
    return { count: onsets.length, errors }
  })
  expect(result.count).toBe(16)
  const sorted = [...result.errors].sort((a, b) => a - b)
  expect(sorted[8]).toBeLessThan(0.003)
  expect(sorted[15]).toBeLessThan(0.01)
})
```

Run: `npm run test:e2e && npm run typecheck`
Expected: `2 passed`, keine Typfehler.

- [ ] **Step 8: Commit**

```bash
git add src/audio/onset src/audio/mic.ts src/audio/recorder.ts src/audio/recorder.test.ts tests/e2e/worklet.spec.ts
git commit -m "feat: Mikrofon mit Onset-Worklet und Aufnahme" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 10: Kalibrierung und lokale Speicherung

**Files:**
- Create: `src/audio/calibration.ts`, `src/storage/localStore.ts`
- Test: `src/audio/calibration.test.ts`, `src/storage/localStore.test.ts`

**Interfaces:**
- Consumes: `median` (Task 3), `DetectorParams` (Task 5)
- Produces:
  - `detectBleed(clickTimes, onsetTimes, windowSeconds = 0.15, minHits = 4): { hits; total; bleed }`
  - `measureLatency(clickTimes, onsetTimes, opts?): LatencyResult` (`ok: true` mit `latencySeconds`, `spreadSeconds`, `matched` oder `ok: false` mit `reason: 'zu-wenige' | 'zu-unruhig'`)
  - `latencyWarning(latencySeconds): 'bluetooth' | null`, `correctOnsetTime(onsetTime, latencySeconds): number`
  - `type CalibrationRecord`, `loadCalibration(storage?)`, `saveCalibration(record, storage?)`, `loadDetectorParams(storage?)`, `saveDetectorParams(params, storage?)`, `clearDetectorParams(storage?)`, `type KeyValueStorage`

- [ ] **Step 1: Tests schreiben**

`src/audio/calibration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { correctOnsetTime, detectBleed, latencyWarning, measureLatency } from './calibration'

const clicks = [0, 1, 2, 3, 4, 5, 6, 7]

describe('detectBleed', () => {
  it('erkennt Klicks, die über die Lautsprecher ins Mikrofon kommen', () => {
    const onsets = clicks.slice(0, 5).map((t) => t + 0.03)
    expect(detectBleed(clicks, onsets)).toEqual({ hits: 5, total: 8, bleed: true })
  })
  it('bleibt ruhig bei Kopfhörern', () => {
    expect(detectBleed(clicks, [2.5, 6.6])).toEqual({ hits: 0, total: 8, bleed: false })
  })
})

describe('measureLatency', () => {
  it('nimmt den Median der Abweichungen', () => {
    const offsets = [0.041, 0.038, 0.045, 0.04, 0.043, 0.039, 0.042, 0.2]
    const result = measureLatency(clicks, clicks.map((t, i) => t + offsets[i]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.latencySeconds).toBeCloseTo(0.0415, 4)
      expect(result.matched).toBe(8)
    }
  })

  it('verlangt mindestens 6 Treffer', () => {
    const result = measureLatency(clicks, [0.05, 1.05, 2.05])
    expect(result).toMatchObject({ ok: false, reason: 'zu-wenige', matched: 3 })
  })

  it('lehnt zu unruhige Messungen ab', () => {
    const offsets = [0, 0.1, 0.02, 0.15, 0.01, 0.12, 0.03, 0.14]
    expect(measureLatency(clicks, clicks.map((t, i) => t + offsets[i]))).toMatchObject({ ok: false, reason: 'zu-unruhig' })
  })

  it('verwendet jeden Einsatz nur einmal', () => {
    const result = measureLatency([0, 0.3], [0.05], { minMatched: 1 })
    expect(result).toMatchObject({ ok: true, matched: 1 })
  })
})

describe('Hilfen', () => {
  it('warnt ab 120 ms vor Bluetooth', () => {
    expect(latencyWarning(0.08)).toBeNull()
    expect(latencyWarning(0.19)).toBe('bluetooth')
  })
  it('zieht die Latenz ab', () => {
    expect(correctOnsetTime(5.06, 0.04)).toBeCloseTo(5.02)
  })
})
```

`src/storage/localStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/audio/calibration.test.ts src/storage`
Expected: FAIL mit `Failed to resolve import "./calibration"` bzw. `"./localStore"`.

- [ ] **Step 3: Implementierung**

`src/audio/calibration.ts`:

```ts
import { median } from '../domain/stats'

export type BleedResult = { hits: number; total: number; bleed: boolean }

/**
 * Kopfhörer-Check: Klicks laufen, du bist still. Hört das Mikrofon mindestens `minHits`
 * Klicks (Einsatz bis `windowSeconds` nach dem Klick), kommt der Klick über die Lautsprecher.
 */
export function detectBleed(clickTimes: number[], onsetTimes: number[], windowSeconds = 0.15, minHits = 4): BleedResult {
  const hits = clickTimes.filter((t) => onsetTimes.some((o) => o >= t && o <= t + windowSeconds)).length
  return { hits, total: clickTimes.length, bleed: hits >= minHits }
}

export type LatencyResult =
  | { ok: true; latencySeconds: number; spreadSeconds: number; matched: number }
  | { ok: false; reason: 'zu-wenige' | 'zu-unruhig'; matched: number; spreadSeconds: number }

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * Latenz-Messung: Du sprichst "Ta" auf jeden Klick. Pro Klick zählt der erste Einsatz im Fenster
 * [-100 ms, +400 ms]. Ergebnis ist der Median der Abweichungen. Streuung = Interquartilsabstand.
 */
export function measureLatency(
  clickTimes: number[],
  onsetTimes: number[],
  opts: { searchFrom?: number; searchTo?: number; minMatched?: number; maxSpread?: number } = {},
): LatencyResult {
  const { searchFrom = -0.1, searchTo = 0.4, minMatched = 6, maxSpread = 0.04 } = opts
  const used = new Set<number>()
  const offsets: number[] = []
  for (const t of clickTimes) {
    const index = onsetTimes.findIndex((o, i) => !used.has(i) && o >= t + searchFrom && o <= t + searchTo)
    if (index >= 0) {
      used.add(index)
      offsets.push(onsetTimes[index] - t)
    }
  }
  const sorted = [...offsets].sort((a, b) => a - b)
  const spread = sorted.length >= 2 ? quantile(sorted, 0.75) - quantile(sorted, 0.25) : 0
  if (offsets.length < minMatched) return { ok: false, reason: 'zu-wenige', matched: offsets.length, spreadSeconds: spread }
  if (spread > maxSpread) return { ok: false, reason: 'zu-unruhig', matched: offsets.length, spreadSeconds: spread }
  return { ok: true, latencySeconds: median(offsets), spreadSeconds: spread, matched: offsets.length }
}

/** Über 120 ms ist vermutlich ein Bluetooth-Kopfhörer im Spiel (Spec 7.5). */
export function latencyWarning(latencySeconds: number): 'bluetooth' | null {
  return latencySeconds > 0.12 ? 'bluetooth' : null
}

/** Rechnet einen erkannten Einsatz auf die Raster-Zeit zurück. */
export function correctOnsetTime(onsetTime: number, latencySeconds: number): number {
  return onsetTime - latencySeconds
}
```

`src/storage/localStore.ts`:

```ts
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
```

- [ ] **Step 4: Tests und Typecheck**

Run: `npx vitest run src/audio/calibration.test.ts src/storage && npm run typecheck`
Expected: 11 Tests PASS, keine Typfehler.

- [ ] **Step 5: Commit**

```bash
git add src/audio/calibration.ts src/audio/calibration.test.ts src/storage
git commit -m "feat: Kopfhörer-Check, Latenz-Messung und lokale Speicherung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 11: Debug-Ansicht `/debug/audio`

**Files:**
- Create: `src/ui/debug/analysis.ts`, `src/ui/debug/takeFile.ts`, `src/ui/debug/debugPatterns.ts`, `src/ui/debug/useAudioLab.ts`, `src/ui/debug/LiveView.tsx`, `src/ui/debug/DebugAudioPage.tsx`
- Test: `src/ui/debug/analysis.test.ts`, `src/ui/debug/takeFile.test.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: alles aus Task 3 bis 10
- Produces:
  - `matchNearest(expected, onsets, step): { marks: MatchedMark[]; extras }`, `summarize(marks, extras): DebugSummary` (`analysis.ts`)
  - `type TakeFile` (Version 1: `patternId`, `bpm`, `sampleRate`, `latencySeconds`, `detectorParams`, `expected[]`, `onsets[]`, Zeiten ab Aufnahmebeginn), `buildTakeFile(input)`, `takeBaseName(patternId, bpm, date)`, `download(name, data, type)` (`takeFile.ts`)
  - Route `/debug/audio`

- [ ] **Step 1: Tests schreiben**

`src/ui/debug/analysis.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { matchNearest, summarize, type ExpectedMark } from './analysis'

const expected: ExpectedMark[] = [0, 0.25, 0.5, 0.75].map((t, i) => ({ t, syl: i % 2 ? 'ka' : 'ta', accent: i === 0, loop: 0 }))

describe('matchNearest', () => {
  it('ordnet nächstgelegene Einsätze zu und klassifiziert', () => {
    const onsets = [0.01, 0.33, 0.6, 0.62].map((t) => ({ t, peakDb: -20 }))
    const { marks, extras } = matchNearest(expected, onsets, 0.25)
    expect(marks.map((m) => m.cls)).toEqual(['hit', 'late', 'late', 'miss'])
    expect(marks[1].offset).toBeCloseTo(0.08)
    expect(marks[2].offset).toBeCloseTo(0.1)
    expect(marks[3].offset).toBeNull()
    expect(extras.map((o) => o.t)).toEqual([0.62])
  })
})

describe('summarize', () => {
  it('fasst Treffer, Mediane und Silben zusammen', () => {
    const onsets = [0.01, 0.27, 0.51, 0.77].map((t) => ({ t, peakDb: -20 }))
    const { marks, extras } = matchNearest(expected, onsets, 0.25)
    const summary = summarize(marks, extras.length)
    expect(summary).toMatchObject({ expected: 4, matched: 4, extras: 0 })
    expect(summary.medianSignedMs).toBeCloseTo(15)
    expect(summary.perSyllable.find((s) => s.syl === 'ka')?.medianSignedMs).toBeCloseTo(20)
  })
})
```

`src/ui/debug/takeFile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_DETECTOR_PARAMS } from '../../audio/onset/detector'
import { buildTakeFile, takeBaseName } from './takeFile'

describe('buildTakeFile', () => {
  it('rechnet Zeiten relativ zum Aufnahmebeginn und lässt Früheres weg', () => {
    const take = buildTakeFile({
      patternId: 'tkdm',
      bpm: 100,
      sampleRate: 48000,
      recordingStartTime: 10,
      latencySeconds: 0.04,
      detectorParams: DEFAULT_DETECTOR_PARAMS,
      expected: [
        { t: 9.5, syl: 'ta', accent: false },
        { t: 12.25, syl: 'ka', accent: false },
      ],
      onsets: [
        { time: 9.9, peakDb: -30 },
        { time: 12.3, peakDb: -18 },
      ],
    })
    expect(take.expected).toEqual([{ t: 2.25, syl: 'ka', accent: false }])
    expect(take.onsets).toEqual([{ t: 2.3, peakDb: -18 }])
    expect(take.version).toBe(1)
  })
})

describe('takeBaseName', () => {
  it('baut einen dateisicheren Namen', () => {
    expect(takeBaseName('tkdm', 100, new Date('2026-10-02T20:15:30.123Z'))).toBe('take-tkdm-100bpm-2026-10-02T20-15-30')
  })
})
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/ui/debug`
Expected: FAIL mit `Failed to resolve import "./analysis"` bzw. `"./takeFile"`.

- [ ] **Step 3: Analyse und Take-Format implementieren**

`src/ui/debug/analysis.ts`:

```ts
import { median } from '../../domain/stats'
import type { SyllableId } from '../../domain/types'
import { classifyOffset, timingWindows, type TimingClass } from '../../domain/windows'

/**
 * Einfache Zuordnung für die Debug-Ansicht: jede erwartete Silbe bekommt den nächstgelegenen
 * freien Einsatz innerhalb ±halber Rasterschritt. (Die echte Bewertung mit DP-Zuordnung folgt in Plan 2.)
 */

export type ExpectedMark = { t: number; syl: SyllableId; accent: boolean; loop: number }
export type OnsetMark = { t: number; peakDb: number }

export type MatchedMark = ExpectedMark & { offset: number | null; peakDb: number | null; cls: TimingClass }

export type DebugSummary = {
  expected: number
  matched: number
  extras: number
  medianAbsMs: number
  medianSignedMs: number
  perSyllable: { syl: SyllableId; n: number; medianSignedMs: number }[]
}

export function matchNearest(expected: ExpectedMark[], onsets: OnsetMark[], step: number): { marks: MatchedMark[]; extras: OnsetMark[] } {
  const windows = timingWindows(step)
  const used = new Set<number>()
  const marks = expected.map((e): MatchedMark => {
    let best = -1
    for (let j = 0; j < onsets.length; j++) {
      if (used.has(j) || Math.abs(onsets[j].t - e.t) >= step / 2) continue
      if (best === -1 || Math.abs(onsets[j].t - e.t) < Math.abs(onsets[best].t - e.t)) best = j
    }
    if (best === -1) return { ...e, offset: null, peakDb: null, cls: 'miss' }
    used.add(best)
    const offset = onsets[best].t - e.t
    return { ...e, offset, peakDb: onsets[best].peakDb, cls: classifyOffset(offset, windows) }
  })
  return { marks, extras: onsets.filter((_, j) => !used.has(j)) }
}

export function summarize(marks: MatchedMark[], extras: number): DebugSummary {
  const offsets = marks.flatMap((m) => (m.offset === null ? [] : [m.offset]))
  const bySyl = new Map<SyllableId, number[]>()
  for (const m of marks) {
    if (m.offset === null) continue
    bySyl.set(m.syl, [...(bySyl.get(m.syl) ?? []), m.offset])
  }
  return {
    expected: marks.length,
    matched: offsets.length,
    extras,
    medianAbsMs: median(offsets.map(Math.abs)) * 1000,
    medianSignedMs: median(offsets) * 1000,
    perSyllable: [...bySyl.entries()].map(([syl, values]) => ({ syl, n: values.length, medianSignedMs: median(values) * 1000 })),
  }
}
```

`src/ui/debug/takeFile.ts`:

```ts
import type { DetectorParams } from '../../audio/onset/detector'
import type { SyllableId } from '../../domain/types'

/**
 * Format für exportierte Aufnahmen (Test-Fixtures). Alle Zeiten in Sekunden ab dem ersten
 * Sample der zugehörigen WAV-Datei. `onsets` sind die live erkannten, unkorrigierten Einsätze.
 */
export type TakeFile = {
  version: 1
  patternId: string
  bpm: number
  sampleRate: number
  latencySeconds: number
  detectorParams: DetectorParams
  expected: { t: number; syl: SyllableId; accent: boolean }[]
  onsets: { t: number; peakDb: number }[]
}

export function buildTakeFile(input: {
  patternId: string
  bpm: number
  sampleRate: number
  recordingStartTime: number
  latencySeconds: number
  detectorParams: DetectorParams
  expected: { t: number; syl: SyllableId; accent: boolean }[]
  onsets: { time: number; peakDb: number }[]
}): TakeFile {
  const rel = (t: number) => Number((t - input.recordingStartTime).toFixed(6))
  return {
    version: 1,
    patternId: input.patternId,
    bpm: input.bpm,
    sampleRate: input.sampleRate,
    latencySeconds: input.latencySeconds,
    detectorParams: input.detectorParams,
    expected: input.expected.filter((e) => e.t >= input.recordingStartTime).map((e) => ({ ...e, t: rel(e.t) })),
    onsets: input.onsets.filter((o) => o.time >= input.recordingStartTime).map((o) => ({ t: rel(o.time), peakDb: o.peakDb })),
  }
}

export function takeBaseName(patternId: string, bpm: number, date: Date): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `take-${patternId}-${bpm}bpm-${stamp}`
}

/** Startet im Browser den Download einer Datei. */
export function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
```

Run: `npx vitest run src/ui/debug`
Expected: 4 Tests PASS.

- [ ] **Step 4: Test-Patterns, Zustand und Live-Grafik**

`src/ui/debug/debugPatterns.ts`:

```ts
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

/** Viertel ohne Akzent, für Kopfhörer-Check und Latenz-Messung. */
export const CALIBRATION_PATTERN: Pattern = { id: 'calibration', title: 'Kalibrierung', beats: bar(1) }
```

`src/ui/debug/useAudioLab.ts`:

```ts
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
  const runRef = useRef<{ pattern: Pattern; bpm: number; playback: Playback } | null>(null)
  /** Letzter Lauf, damit nach "Stopp" noch exportiert werden kann. */
  const lastRunRef = useRef<{ pattern: Pattern; bpm: number; playback: Playback } | null>(null)
  const timersRef = useRef<number[]>([])
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
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      await ctx.resume()
      const bank = await loadSampleBank(ctx)
      const mic = await openMic(ctx, onMicMessage)
      mic.setParams(stateRef.current.params)
      ctxRef.current = ctx
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
    micRef.current?.flush()
    runRef.current = null
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
      mic.reset({ ...stateRef.current.params, minIoiSeconds: minIoiForGrid(gridStep(pattern, bpm)) })
      const playback = engine.start({ pattern, bpm, countInBars: 1, loops: null, click, voice })
      runRef.current = { pattern, bpm, playback }
      lastRunRef.current = runRef.current
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
      patch({ params })
    },
    [patch],
  )

  const resetParams = useCallback(() => {
    clearDetectorParams()
    micRef.current?.setParams(DEFAULT_DETECTOR_PARAMS)
    patch({ params: { ...DEFAULT_DETECTOR_PARAMS } })
  }, [patch])

  const exportTake = useCallback(() => {
    const recorder = recorderRef.current
    const ctx = ctxRef.current
    const source = lastRunRef.current
    const start = recorder?.startTime
    if (!recorder || !ctx || start === null || start === undefined || recorder.durationSeconds < 1) {
      patch({ message: 'Noch keine Aufnahme. Starte zuerst einen Testlauf mit Mikrofon.' })
      return
    }
    if (!source) return
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
      latencySeconds: latency(),
      detectorParams: { ...stateRef.current.params, minIoiSeconds: minIoiForGrid(gridStep(pattern, bpm)) },
      expected,
      onsets: onsetsRef.current,
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

  useEffect(
    () => () => {
      clearTimers()
      engineRef.current?.stop()
      micRef.current?.close()
      void ctxRef.current?.close()
    },
    [],
  )

  return { state, init, stop, runBleedCheck, runLatency, startRun, setParam, resetParams, exportTake, liveData }
}
```

`src/ui/debug/LiveView.tsx`:

```tsx
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
```

- [ ] **Step 5: Seite und Route**

`src/ui/debug/DebugAudioPage.tsx`:

```tsx
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
              <Button variant="ghost" onClick={lab.exportTake} disabled={state.mode === 'run'} icon={<DownloadSimple size={20} weight="bold" />}>
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
```

`src/ui/App.tsx`:

```tsx
import { Route, Routes } from 'react-router'
import { DebugAudioPage } from './debug/DebugAudioPage'
import { HomePage } from './pages/HomePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/debug/audio" element={<DebugAudioPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
```

- [ ] **Step 6: Alles prüfen**

Run: `npm test && npm run test:e2e && npm run build`
Expected: alle Vitest-Tests PASS, Playwright `2 passed`, Build `✓ built`.

- [ ] **Step 7: Sichtprüfung (mit Mikrofon, Kopfhörer auf)**

Run: `npm run dev`, `http://localhost:5173/debug/audio` öffnen.
Expected:
1. "Audio starten" fragt nach dem Mikrofon, danach Status mit Abtastrate, Ausgabe-Latenz, Mikrofon-Name, Kalibrierung "fehlt".
2. "Kopfhörer-Check": 8 Klicks, Meldung "Kopfhörer-Check bestanden".
3. "Latenz messen": Einzählen, 8 Klicks mit "Ta", Meldung "Latenz … ms, Streuung … ms. Gespeichert."
4. "Start" mit Ta-ka-di-mi bei 80 BPM, mitsprechen: In der Live-Grafik erscheint pro Silbe ein senkrechter Strich, unten Punkte in Petrol. Nach jedem Durchgang aktualisiert sich die Auswertung.
5. "Stopp", dann "Take exportieren": Download von `take-takadimi-80bpm-….wav` und `.json`.

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat: Debug-Ansicht für Kalibrierung und Einsatz-Erkennung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 12: Test für echte Takes, Doku und Abnahme

**Files:**
- Create: `src/audio/onset/takes.test.ts`, `tests/fixtures/takes/.gitkeep`
- Modify: `README.md`

**Interfaces:**
- Consumes: `TakeFile` (Task 11), `detectOnsets` (Task 5), `decodeWav` (Task 4), `matchStats` (Task 5)

- [ ] **Step 1: Test für exportierte Takes**

`src/audio/onset/takes.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { median } from '../../domain/stats'
import type { TakeFile } from '../../ui/debug/takeFile'
import { decodeWav } from '../dsp/wav'
import { detectOnsets } from './detector'
import { matchStats } from './testSignals'

/**
 * Prüft echte Aufnahmen aus der Debug-Ansicht (tests/fixtures/takes/*.json + .wav).
 * Ohne Fixtures wird nichts geprüft.
 */
const DIR = path.resolve(import.meta.dirname, '../../../tests/fixtures/takes')
const takes = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : []

describe.skipIf(takes.length === 0)('Echte Takes', () => {
  for (const file of takes) {
    it(file, () => {
      const take = JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as TakeFile
      const { samples, sampleRate } = decodeWav(new Uint8Array(readFileSync(path.join(DIR, file.replace(/\.json$/, '.wav')))))
      expect(sampleRate).toBe(take.sampleRate)

      const offline = detectOnsets(samples, sampleRate, take.detectorParams).map((o) => o.time)
      const targets = take.expected.map((e) => e.t + take.latencySeconds)
      const steps = take.expected.slice(1).map((e, i) => e.t - take.expected[i].t)
      const step = Math.min(...steps.filter((s) => s > 0.001))
      const stats = matchStats(targets, offline, step)

      // Erkennung: fast alle Silben gefunden, kaum Fehl-Einsätze.
      expect(stats.matched / targets.length).toBeGreaterThanOrEqual(0.95)
      expect(stats.extras / targets.length).toBeLessThanOrEqual(0.03)
      // Plausibilität: Abweichung inkl. menschlichem Timing bleibt im Rahmen.
      expect(median(stats.errors.map(Math.abs))).toBeLessThan(0.04)
      // Worklet und Offline-Analyse liefern dieselben Einsätze (gleicher Algorithmus).
      const live = take.onsets.map((o) => o.t)
      const liveVsOffline = matchStats(live, offline, 0.02)
      expect(liveVsOffline.matched / Math.max(1, live.length)).toBeGreaterThanOrEqual(0.98)
    })
  }
})
```

```bash
mkdir -p tests/fixtures/takes && touch tests/fixtures/takes/.gitkeep
```

Run: `npx vitest run src/audio/onset/takes.test.ts`
Expected: Datei übersprungen ("1 skipped"), solange keine Takes vorliegen.

- [ ] **Step 2: README ergänzen**

In `README.md` den Abschnitt `## Starten` ersetzen durch:

````markdown
## Starten

```bash
# App bauen und starten, danach http://localhost:8080 öffnen
docker compose up --build
```

Für die Entwicklung: `npm install`, dann `npm run dev` (http://localhost:5173).

Das Mikrofon funktioniert nur über `localhost` oder HTTPS. Für die lokale Nutzung reicht `localhost`.

### Audio testen

Unter `/debug/audio` gibt es eine Testseite: Kopfhörer-Check, Latenz messen, Patterns mitsprechen und die erkannten Silben live sehen. Mit "Take exportieren" entstehen eine WAV- und eine JSON-Datei. In `tests/fixtures/takes/` abgelegt, prüft `npm test` sie automatisch.

### Tests

```bash
npm test            # Unit-Tests (Vitest)
npm run test:e2e    # Browser-Tests (Playwright, einmalig: npx playwright install chromium)
```
````

Den Abschnitt `### Sounds neu generieren (optional)` so ergänzen, dass er auch die Stimmwahl nennt:

````markdown
### Sounds neu generieren (optional)

Die gesprochenen Silben und UI-Sounds werden einmalig mit ElevenLabs erzeugt und liegen fertig im Repo unter `public/sounds/`. Neu generieren musst du sie nur, wenn sich Stimme oder Silben ändern:

```bash
cp .env.example .env              # dann ELEVENLABS_API eintragen
docker compose run --rm sounds voices   # Hörproben nach tools/.audition/
# voiceId in tools/sounds.config.json eintragen
docker compose run --rm sounds build    # alle Sounds nach public/sounds/
```

Ohne Docker gehen dieselben Befehle mit `npm run sounds -- voices` bzw. `npm run sounds -- build`. Der API-Key wird nur von diesem Skript gelesen. Er landet weder im Browser noch im Docker-Image.
````

Den Status-Hinweis oben ändern auf:

```markdown
> **Status:** Plan 1 (Gerüst und Audio-Kern) umgesetzt, Abnahme der Einsatz-Erkennung läuft. Details in der [Design-Spec](docs/superpowers/specs/2026-10-02-konnakol-trainer-design.md) und in [Plan 1](docs/superpowers/plans/2026-10-02-plan-1-geruest-und-audio-kern.md).
```

- [ ] **Step 3: Gesamtprüfung**

Run:

```bash
npm test && npm run test:e2e && npm run build
docker compose up --build -d && curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/debug/audio && docker compose down
```

Expected: alle Tests grün (Take-Test übersprungen), Build ok, `200`.

- [ ] **Step 4: Commit**

```bash
git add src/audio/onset/takes.test.ts tests/fixtures/takes/.gitkeep README.md
git commit -m "test: Prüfung echter Takes und Doku zur Audio-Testseite" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 5: CHECKPOINT Luca: Abnahme der Einsatz-Erkennung (Spec 13, Phase 2)**

Luca arbeitet in der laufenden App (`docker compose up --build`, `http://localhost:8080/debug/audio`) mit Kopfhörern:

1. Kopfhörer-Check und Latenz messen.
2. Pro Pattern ein Lauf von mindestens 8 Durchgängen, mitsprechen, dann "Take exportieren":
   - Ta-ka (Achtel) bei 100 BPM
   - Ta-ki-ta (Triolen) bei 80 BPM
   - Ta-ka-di-mi (16tel) bei 80 und 120 BPM
   - Ta-di-gi-na-thom (Quintolen) bei 70 BPM
   - 3+3+2 bei 90 BPM
3. Die Dateien nach `tests/fixtures/takes/` legen und `npx vitest run src/audio/onset/takes.test.ts` ausführen.

Abnahmekriterien:
- In jedem Take ≥ 95 % der Silben erkannt und ≤ 3 % Fehl-Einsätze (Test grün).
- Luca bestätigt in der Live-Grafik, dass die Punkte dort sitzen, wo er die Silben hört.
- Die Auswertung "pro Silbe" zeigt keine Silbe, die systematisch mehr als ±15 ms vom Durchschnitt der anderen abweicht. Falls doch: Wert notieren, er wird in Plan 2 als Silben-Offset berücksichtigt.

Wenn Detektor-Werte per Schieberegler angepasst werden mussten: die gefundenen Werte in `DEFAULT_DETECTOR_PARAMS` (`src/audio/onset/detector.ts`) übernehmen, `npm test` laufen lassen, committen.

Die Takes bleiben lokal (Entscheid Luca, 2026-10-03): `tests/fixtures/takes/*` steht in `.gitignore`, nur `.gitkeep` ist im Repo.

Danach: Plan 2 schreiben (Bewertung und Übungstypen).
