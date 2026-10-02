# Konnakol-Trainer ("taka") – Design-Spec

- **Datum:** 2026-10-02
- **Status:** Design abgestimmt, bereit für den Implementierungsplan
- **Arbeitstitel:** taka (Name jederzeit änderbar)

## 1. Ziel

Eine Lern-Webapp im Duolingo-Stil, mit der ein Musiker Konnakol (südindische Rhythmus-Sprache) als **Rhythmus-Werkzeug für das eigene Spiel** lernt: Unterteilungen, Gruppierungen über 4/4, Pausen und Akzente sprechen und dabei präziser im Timing werden. Die App hört über das Mikrofon zu und bewertet Timing (und ab Unit 4 Akzente) pro Silbe.

## 2. Nutzer und Rahmen

- **Nutzer:** zunächst nur Luca (Musiker, kennt Noten und Taktarten, Konnakol neu). Später evtl. weitere Personen, deshalb ist die Speicherschicht austauschbar (siehe 9.4).
- **Gerät:** Laptop/Desktop mit Kopfhörern (kabelgebunden empfohlen). Zielbreite ab 1024 px, Tablet bedienbar, Handy nicht optimiert.
- **Ausrichtung:** westlicher 4/4-Kontext. Karnatische Silben als Werkzeug, keine Tala-Handzählung in v1.
- **Betrieb:** Docker-Container, lokal unter `http://localhost:8080`.

### In v1

- Lernpfad Unit 1 bis 4 inkl. Checkpoints und Theorie-Karten
- Vier Übungstypen: Hör-Quiz, Mitsprechen mit Ausblenden, Nachsprechen, Vom Blatt
- Mikrofon-Bewertung (Timing, ab Unit 4 Akzente), Latenz-Kalibrierung, Kopfhörer-Check
- Auswertung pro Silbe, Tendenz-Hinweis, Aufnahme anhören
- XP, Tempo-Stufen, Streak, Tagesziel (Minuten)
- Schwachstellen-Training, Freies Üben, Einstellungen, Export/Import
- Raster linear und zyklisch (umschaltbar), Notenschrift ein-/ausblendbar
- Debug-Ansicht für die Einsatz-Erkennung
- Hell- und Dunkel-Modus

### Nicht in v1

- Units 5 bis 8 (Kombinationen, Wechsel der Unterteilung, Polyrhythmen, Kadenzen/Korvai)
- Accounts, Server, Sync zwischen Geräten
- Herzen/Leben, Ligen
- Drum-Groove oder Percussion-Begleitung (nur Klick)
- Eigene Patterns bauen (Editor)
- Mobile-Optimierung, PWA/Offline-Installation
- Erkennung, *welche* Silbe gesprochen wurde (nur *wann* und *wie laut*)

## 3. Inhalt

### 3.1 Silbensystem

Jede Gruppengrösse hat ein festes Wort. Die erste Silbe ist die Gruppen-Eins und trägt den Akzent, wenn Akzente verlangt sind.

| Grösse | Silben | Westlich |
|---|---|---|
| 1 | Ta | Viertel |
| 2 | Ta-ka | Achtel |
| 3 | Ta-ki-ta | Triolen |
| 4 | Ta-ka-di-mi | 16tel |
| 5 | Ta-di-gi-na-thom | Quintolen |
| 6 | Ta-ki-ta-Ta-ki-ta | Sextolen (3+3) |
| 7 | Ta-ki-ta-Ta-ka-di-mi | Septolen (3+4) |

- Benötigte Sample-Silben: **Ta, Ka, Ki, Di, Mi, Gi, Na, Thom** (Gross/Klein ist nur Darstellung).
- Pausen erscheinen im Raster als `·` und werden nicht gesprochen.
- Westliche Zählweise unter dem Raster: `1 e + e 2 e + e …` (16tel), `1 + 2 + …` (Achtel), Triolen `1 – – 2 – –` usw.

### 3.2 Lernpfad v1

Jede Lektion hat Tempo-Stufen (Viertel-BPM). Die Werte stehen in den Content-Dateien und können pro Lektion überschrieben werden.

**Unit 1: Silben & Puls** (Stufen 60 / 80 / 100 / 120)
1. Ta (Viertel)
2. Ta-ka (Achtel)
3. Ta-ki-ta (Triolen)
4. Ta-ka-di-mi (16tel)
5. Wechsel: 2 ↔ 4 und 3 ↔ 4, taktweise
6. Checkpoint 1

**Unit 2: Unterteilungen** (Stufen 50 / 60 / 70 / 80)
1. Ta-di-gi-na-thom (Quintolen)
2. Ta-ki-ta-Ta-ki-ta (Sextolen)
3. Ta-ki-ta-Ta-ka-di-mi (Septolen)
4. Die Leiter: 1 → 2 → 3 → 4 → 5 → 6 → 7, ein Takt pro Stufe
5. Checkpoint 2

**Unit 3: Pausen & Lücken** (Stufen 60 / 80 / 100 / 120)
1. Lücken im 16tel-Raster (einzelne Silben fehlen)
2. Offbeats (nur e, +, e)
3. Synkopen (Pausen über Schlaggrenzen)
4. Pausen in Triolen
5. Checkpoint 3

**Unit 4: Gruppierungen über 4/4** (Stufen 60 / 75 / 90 / 105). Ab hier werden Akzente bewertet.
1. 3er-Gruppen auf 16teln bis zur Auflösung (3 Takte)
2. 3+3+2 (zweimal pro Takt)
3. 3+3+3+3+4
4. 5er-Gruppen: 5+5+6 und 5+5+3+3
5. 7er-Gruppen: 7+7+2
6. Checkpoint 4

### 3.3 Lektionen, Theorie, Checkpoints

- Eine Lektion hat 6 bis 8 Übungen (ca. 5 Minuten), typische Reihenfolge: Hör-Quiz → Mitsprechen → Nachsprechen → Vom Blatt.
- Vor neuen Konzepten 1 bis 3 **Theorie-Karten**: kurzer Text mit Bezug zum Instrument, Hörbeispiel-Button, Raster-Beispiel.
- **Checkpoint:** 8 Übungen aus allen Lektionen der Unit, nur Nachsprechen und Vom Blatt (keine Hilfen), Tempo der Stufe 1, bestanden ab 80 %.
- Alle Inhalte (Patterns, Lektionen, Theorie-Texte) sind Daten in `src/content/`. Neue Units sind reine Content-Arbeit.

## 4. Übungstypen

Jede Mikrofon-Übung beginnt mit **einem Einzähltakt** (Klick + gesprochen "Eins, Zwei, Drei, Vier"). Danach läuft der Klick weiter.

| Typ | Ablauf | Mikrofon | Bewertet |
|---|---|---|---|
| **Hör-Quiz** | Phrase mit Klick wird gespielt, beliebig oft wiederholbar; Auswahl aus 3 bis 4 Rastern (Ablenker aus demselben Lektions-Pool) | nein | richtig = 100 %, falsch = 0 % |
| **Mitsprechen mit Ausblenden** | Phrase läuft 4-mal, Stimme 100 % → 60 % → 25 % → 0 % | ja | Durchgänge 3 und 4 |
| **Nachsprechen** | App spricht die Phrase vor, du sprichst sie direkt danach; 3 Zyklen | ja | deine Phrasen |
| **Vom Blatt** | nur Raster und Cursor, kein Vorsprechen; 2 Durchgänge (Patterns ab 3 Takten: 1 Durchgang) | ja | alle Durchgänge |

- Phrasenlänge = Patternlänge. Patterns über 2 Takte werden nicht für Nachsprechen verwendet.
- Ohne Mikrofon-Freigabe: Lektionen und Checkpoints lassen sich nicht starten (Banner mit Anleitung zur Freigabe). Nutzbar bleiben Theorie-Karten und Freies Üben ohne Bewertung. Fortschritt entsteht nur mit Mikrofon.

## 5. Bewertung

### 5.1 Zeitfenster

`s` = Dauer einer Unterteilung in ms (z. B. 16tel bei 120 BPM = 125 ms).

| Toleranz | eng (im Ziel) | weit (knapp) |
|---|---|---|
| normal | clamp(0.20·s, 25, 50) ms | clamp(0.45·s, 50, 120) ms |
| locker | Faktor 1.4 auf beide | |
| streng | Faktor 0.7 auf beide | |

### 5.2 Zuordnung und Klassen

- Erwartete Silbenzeiten E und erkannte Einsätze O (latenzkorrigiert, siehe 7.4) werden per **monotoner DP-Zuordnung** (Sequenz-Alignment) verknüpft. Ein Match ist nur innerhalb des weiten Fensters erlaubt.
- Klassen pro erwarteter Silbe: **im Ziel** (|dt| ≤ eng), **zu früh / zu spät** (eng < |dt| ≤ weit), **verpasst** (kein Match). Nicht zugeordnete Einsätze sind **zu viel**.

### 5.3 Score

- Timing-Score = (im Ziel + 0.5 · knapp − 0.5 · zu viel) / Anzahl erwarteter Silben, begrenzt auf 0 bis 1.
- **Akzent (ab Unit 4):** Pro Gruppe wird der Spitzenpegel der Akzentsilbe mit dem Median der übrigen getroffenen Silben der Gruppe verglichen. Treffer, wenn ≥ 3 dB lauter (locker 2 dB, streng 4 dB). Verpasste Akzentsilben zählen als nicht getroffen. Akzent-Score = Treffer / Akzentsilben.
- Gesamt = Timing (Units 1 bis 3) bzw. 0.75 · Timing + 0.25 · Akzent (ab Unit 4).
- **Übung bestanden** ab 75 %. **Tempo-Stufe bestanden**, wenn der Durchschnitt der besten Versuche aller Übungen der Lektion ≥ 80 % ist; sonst "Fast!" (XP gibt es trotzdem).

### 5.4 Tendenz-Hinweis

Aus den vorzeichenbehafteten Abweichungen der getroffenen Silben werden Kandidaten gebildet: gesamt, nach Position in der Gruppe (z. B. letzte Silbe vor neuer Gruppe), nach Lage zum Schlag (auf dem Schlag vs. dazwischen), nach Gruppengrösse. Ein Kandidat zählt bei mindestens 3 Silben, |Mittelwert| ≥ 15 ms und ≥ 70 % gleichem Vorzeichen. Der stärkste wird als ein Satz ausgegeben ("Du eilst beim 'ka' vor jeder neuen 3er-Gruppe um ca. 30 ms."). Ohne Kandidat: "Kein klares Muster, weiter so."

### 5.5 Auswertungs-Screen

Raster mit Markierungen (Farbe **und** Symbol: ← zu früh, → zu spät, × verpasst, Punkt = zu viel, amberfarbenes `>` = Akzent zu leise), Score, Tendenz, Zeile "Timing x von y im Ziel, Akzente a von b". Buttons: **Weiter**, **Anhören** (eigene Aufnahme + Klick), **Nochmal**.

## 6. Spielmechanik

- **Kein Herzen-System.** Nicht bestandene Übungen werden einmal ans Lektionsende gehängt. Scheitert die Wiederholung, wandert das Pattern ins Schwachstellen-Training, die Lektion läuft weiter.
- **XP pro Übung** = round(10 · Score · Stufenfaktor), Stufenfaktor 1.0 / 1.25 / 1.5 / 2.0. Lektionsabschluss +10 XP.
- **Freischalten:** Lektion n+1 nach bestandener Stufe 1 von Lektion n. Checkpoint, wenn alle Lektionen der Unit Stufe 1 haben. Nächste Unit nach bestandenem Checkpoint. "Gemeistert" = höchste Stufe bestanden.
- **Tagesziel:** 5 / 10 / 15 / 20 Minuten aktive Übungszeit (Standard 10). Aktiv = Zeit vom Start einer Übung bis zur Auswertung, inkl. Freies Üben.
- **Streak:** zählt aufeinanderfolgende Tage mit erreichtem Tagesziel. Tagesgrenze = lokale Mitternacht. Ein verpasster Tag setzt auf 0 (kein Streak-Freeze in v1).
- **Schwachstellen:** Pro Pattern ein gleitender Score (EMA, α = 0.3). Schwach, wenn EMA < 0.75 oder in einer Lektion zweimal gescheitert. Ab 3 schwachen Patterns erscheint eine Wiederholungs-Lektion (max. 6 Patterns, Tempo = max(niedrigste Stufe, Tempo des Scheiterns − 10 BPM)). Ein Pattern verlässt die Liste, sobald EMA ≥ 0.75.
- **Freies Üben:** Patterns aller freigeschalteten Lektionen, 40 bis 200 BPM, Modus Mitsprechen (Stimme an/aus) oder Vom Blatt, Endlos-Loop, Live-Bewertung pro Durchgang an/aus. Zählt fürs Tagesziel, gibt keine XP.

## 7. Audio

### 7.1 Sound-Generierung (`tools/`, einmalig)

- **ElevenLabs Text-to-Speech** für die 8 Silben (je normal und betont) und die Einzählwörter "Eins, Zwei, Drei, Vier". **ElevenLabs Sound Effects** für UI-Sounds (richtig, verpasst, Lektion geschafft, Streak).
- **Stimmwahl:** Das Skript erzeugt Hörproben von 3 bis 4 Stimmen (Testphrase "Ta-ki-ta Ta-ka-di-mi"). Luca wählt, die Voice-ID kommt in `tools/sounds.config.json`.
- Pro Silbe mehrere Takes. Fallback, falls Einzelsilben unnatürlich klingen: Silbe in einer Trägerphrase erzeugen ("ta ta ta") und die mittlere ausschneiden.
- **Nachbearbeitung in Node** (kein ffmpeg): Stille vorne bis Schwelle −40 dBFS abschneiden, max. 350 ms Länge, 30 ms Fade-out, Pegel angleichen (Peak −1 dBFS, ähnlicher RMS).
- **Format WAV, 16 Bit, mono.** Kein MP3 (Encoder-Vorlauf von ca. 25 ms würde das Timing verfälschen). Wenn verfügbar, liefert die API direkt PCM; Modell, Ausgabeformat und Endpunkte werden bei der Umsetzung gegen die aktuelle API-Doku geprüft.
- Ausgabe nach `public/sounds/`, **wird committet** (reproduzierbarer Build, keine API-Kosten pro Build, kein Key im Image).
- Ergebnis-Manifest `public/sounds/manifest.json` mit Dateiname, Dauer und **P-Center-Offset** pro Silbe (siehe 7.3).

### 7.2 Wiedergabe

- Ein `AudioContext` (`latencyHint: 'interactive'`). Scheduler nach dem Lookahead-Prinzip: alle 25 ms werden Ereignisse der nächsten 100 ms sample-genau mit `start(time)` eingeplant.
- **Klick** im Browser synthetisiert: kurzer Sinus-Burst (ca. 30 ms, exponentielles Abklingen), Zählzeit 1 höher und lauter.
- **Stimme:** jede Silbe stoppt die vorherige (5 ms Fade), damit schnelle Passagen nicht verschmieren. Ausblenden über einen GainNode pro Durchgang.
- Raster-Cursor, Puls-Anzeige und Kreis-Zeiger laufen per `requestAnimationFrame` auf der Audio-Uhr, korrigiert um `outputLatency`.

### 7.3 P-Center-Korrektur

Gesprochene Silben werden nicht beim ersten Konsonanten-Geräusch "auf dem Schlag" wahrgenommen, sondern etwas später (Übergang zum Vokal). Pro Silbe wird ein Offset gemessen (aus dem Sample) und im Manifest gespeichert:

- **Wiedergabe:** Sample startet um den Offset früher, damit der wahrgenommene Schlag auf dem Raster liegt.
- **Erkennung:** erkannter Einsatz + Offset der erwarteten Silbe wird mit der Rasterzeit verglichen.

Die Werte werden in Phase 2 mit Lucas Aufnahmen validiert und bei Bedarf feinjustiert.

### 7.4 Mikrofon und Einsatz-Erkennung

- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`.
- **AudioWorklet** mit Hop von 128 Samples (ca. 3 ms): Detektionsfunktion = positiver Fluss der hochfrequenz-gewichteten Energie (Konsonanten T, K, D, G). Adaptive Schwelle aus dem Grundpegel (gemessen im Einzähltakt, gleitend nachgeführt). Mindestabstand zwischen Einsätzen = max(40 ms, 0.5 · s), damit lange Vokale ("Thom") nicht doppelt zählen.
- Pro Einsatz: Zeitpunkt (Frame-genau auf Audio-Uhr umgerechnet) und Spitzenpegel der folgenden 30 ms (für Akzente).
- Der Erkennungs-Kern ist eine **reine Funktion** (Samples → Einsätze), die im Worklet und offline in Tests läuft.
- Parallel wird die Aufnahme in einen Puffer geschrieben (nur im Arbeitsspeicher) für "Anhören".
- Latenzkorrektur: verglichen wird `Einsatz − Kalibrier-Latenz` mit der erwarteten Zeit.

### 7.5 Kalibrierung (Assistent beim ersten Start, jederzeit wiederholbar)

1. **Kopfhörer-Check:** 8 Klicks bei Stille. Erkennt das Mikrofon ≥ 4 davon (innerhalb 150 ms nach dem Klick), erscheint "Bitte Kopfhörer verwenden" (Fortfahren nur mit expliziter Bestätigung, Bewertung dann als unzuverlässig markiert).
2. **Latenz:** 8-mal "Ta" auf den Klick (60 BPM). Median der Abweichung = Latenz. Ergebnis wird mit Geräte-ID gespeichert.
3. **Ergebnis:** Anzeige in ms. Über 120 ms Hinweis auf vermutlich Bluetooth und Empfehlung für Kabel.

Bei `devicechange` oder anderer Geräte-ID schlägt die App eine Neukalibrierung vor.

### 7.6 Debug-Ansicht (`/debug/audio`)

Live-Wellenform, Detektionsfunktion, Schwelle, erkannte Einsätze und erwartetes Raster. Export einer Aufnahme als WAV + JSON (erwartete Zeiten, BPM, Pattern) als Test-Fixture.

## 8. UI und Design

### 8.1 Grundlook "Tiefes Petrol" (abgeleitet aus Lucas Duolingo-DESIGN.md und Taste-Skill)

| Token | Hell | Dunkel ("Petrol Nacht") |
|---|---|---|
| primary | `#0E6E74` | `#1FA3A3` |
| primary-edge (3D-Kante) | `#08494D` | `#127070` |
| primary-soft | `#E1F0F0` | `#172A2E` |
| bg | `#EEF6F6` | `#0F1D20` |
| surface | `#FFFFFF` | `#172A2E` |
| text | `#2F3A3C` | `#E3EEEE` |
| text-muted | `#5C6B6E` | `#8FA3A5` |
| warn (knapp, Streak) | `#E39A2D` | `#F0AA45` |
| error (verpasst) | `#E2604A` | `#E8705E` |
| line | `#DCE6E6` | `#22363A` |

- **Bedeutung der Farben wie bei Duolingo:** Markenfarbe = richtig. Keine weiteren Akzentfarben. Zustände nie nur über Farbe (immer zusätzlich Symbol oder Text).
- **Schrift:** Nunito 700 bis 900, selbst gehostet (`@fontsource/nunito`), Grundgewicht fett. Kein Inter.
- **Formen:** Karten und Buttons 14 px Radius, Rasterzellen 9 px, Pfad-Knoten rund, Checkpoint-Knoten 16 px. Abstände im 10-px-Raster.
- **Buttons:** 3D mit Unterkante (`box-shadow: 0 4px 0 primary-edge`), bei `:active` 2 px nach unten. Labels einzeilig, Grossbuchstaben, max. 3 Wörter. Ein Verb pro Aktion (Weiter, Nochmal, Anhören, Überspringen, Wiederholen).
- **Motion:** 300 ms ease (Motion-Library). `prefers-reduced-motion` reduziert Animationen, Cursor bleibt.
- **Icons:** Phosphor (`@phosphor-icons/react`), keine Emojis in der UI.
- **Theme:** Auto / Hell / Dunkel in den Einstellungen.
- **Barrierefreiheit:** Fokusring 2 px in primary mit 2 px Abstand, Kontraste WCAG AA, Tastatur: Leertaste = Start/Weiter, R = Nochmal, P = Anhören.
- **Texte:** Deutsch (Schweizer Schreibweise, kein ß), keine Gedankenstriche als Gestaltungsmittel.

### 8.2 Screens

- **Startseite (3 Spalten):** links Navigation (Lernen, Freies Üben, Schwachstellen, Theorie, Einstellungen), Mitte geschwungener Pfad mit Unit-Bannern und Knoten (erledigt, aktuell mit "Start · BPM", gesperrt, Checkpoint) plus Tempo-Stufen-Balken unter jedem Knoten, rechts Streak, XP, Tagesziel-Ring, Schwachstellen-Karte, Audio-Status.
- **Übungs-Screen (Vollbild, ohne Navigation):** oben Schliessen, Lektionsfortschritt, Tempo-Chip. Mitte Aufgabe, Puls-Anzeige 1 bis 4, Raster. Unten Pegelanzeige, Status ("Durchgang 1 von 2, ich höre zu"), Überspringen.
  - **Raster linear (Standard):** Zellen pro Unterteilung, Schläge durch Lücken getrennt, Gruppen-Klammern oben, `>` für Akzente, Zählweise unten, Cursor.
  - **Raster zyklisch (umschaltbar):** Takt als Kreis, Zählzeiten 1 bis 4 aussen, Gruppen als Bögen innen, Zeiger.
  - **Notenschrift (VexFlow, ein-/ausblendbar):** Schlagzeug-Notation mit Balken pro Schlag, Tuplets und Akzenten.
  - Die Wahl linear/zyklisch und Notenschrift an/aus wird gespeichert.
- **Auswertung:** Panel unten (siehe 5.5).
- **Weitere:** Theorie-Karte, Hör-Quiz (Raster als wählbare Karten), Lektionsabschluss (XP, Genauigkeit, Stufe, Streak, Jingle), Kalibrierungs-Assistent, Freies Üben, Einstellungen (Toleranz, Tagesziel, Theme, Raster-Ansicht, Notenschrift, Kalibrierung, Export/Import), Debug-Ansicht.

Mockups aus der Abstimmung liegen lokal unter `.superpowers/brainstorm/` (nicht im Repo).

## 9. Architektur

### 9.1 Stack

Vite, React, TypeScript (strict), Tailwind CSS v4 (Vite-Plugin), Motion (`motion/react`), `@phosphor-icons/react`, `@fontsource/nunito`, Zustand, React Router, VexFlow. Tests: Vitest, Playwright.

### 9.2 Module

| Ordner | Verantwortung | Hängt ab von |
|---|---|---|
| `src/content/` | Silbenwörter, Patterns, Lektionen, Units, Theorie-Texte (reine Daten) | `domain/` Typen |
| `src/domain/` | reine Logik ohne Browser-APIs: Timing, Zuordnung, Score, Akzente, Tendenz, Lektionsablauf, Fortschritt | nichts |
| `src/audio/` | Engine (Samples, Scheduler, Klick, Gain), Mikrofon, Aufnahme, Onset-Worklet, Kalibrierung | `domain/` |
| `src/storage/` | `ProgressStore`-Schnittstelle, localStorage-Umsetzung, Migrationen, Export/Import | `domain/` Typen |
| `src/ui/` | Screens, Komponenten, Stores (Zustand) | alle obigen |
| `tools/` | Sound-Generierung und Stimm-Hörproben (Node, liest `ELEVENLABS_API`) | ElevenLabs API |

### 9.3 Kern-Typen (Skizze)

```ts
type SyllableId = 'ta' | 'ka' | 'ki' | 'di' | 'mi' | 'gi' | 'na' | 'thom';
type Cell = { syl: SyllableId | null; accent?: boolean };   // null = Pause
type Beat = { div: 1 | 2 | 3 | 4 | 5 | 6 | 7; cells: Cell[] }; // cells.length === div
type Pattern = {
  id: string;
  title: string;
  beats: Beat[];            // 4 Beats pro Takt
  groups?: number[];        // Gruppen-Klammern, Summe = Anzahl Zellen
};
type ExerciseType = 'quiz' | 'fade' | 'echo' | 'read';
type ExerciseSpec = { type: ExerciseType; patternId: string; distractorIds?: string[] };
type Lesson = {
  id: string; unitId: string; title: string;
  tempoStages: number[];
  theoryCardIds?: string[];
  exercises: ExerciseSpec[];
  accentScoring: boolean;
};

// domain
expectedEvents(pattern, bpm) -> { t: number; syl: SyllableId; accent: boolean; groupIndex: number; posInGroup: number }[]
align(expected, onsets, windows) -> AlignedResult
scoreExercise(aligned, opts) -> { score: number; timing: number; accent?: number; classes: ... }
tendency(aligned) -> string
applyExerciseResult(state, result, now) / applyLessonResult(state, result, now) -> SaveState

// storage
interface ProgressStore { load(): Promise<SaveState>; save(s: SaveState): Promise<void>; }
```

### 9.4 Daten

`SaveState` als versioniertes JSON (`schemaVersion`) unter einem localStorage-Schlüssel, Migrationen beim Laden. Inhalt: Einstellungen (Toleranz, Tagesziel, Theme, Raster-Ansicht, Notenschrift, Latenz + Geräte-ID), Fortschritt pro Lektion und Stufe (beste Scores), XP, Streak, Tages-Log (aktive Sekunden pro Datum), Pattern-Statistik (EMA, Fehlversuche, Tempo). Export/Import als JSON-Datei. Aufnahmen werden nie gespeichert.

## 10. Docker und Repo

- **Repo:** https://github.com/honegglu/konokol (öffentlich).
- `Dockerfile` (multi-stage): `node:22-alpine` baut (`npm ci`, `npm run build`), `nginx:alpine` liefert `dist/` aus, mit SPA-Fallback, korrekten MIME-Typen (`.wav`, `.js` für das Worklet) und Caching-Headern.
- `docker-compose.yml`:
  - `app`: Build, Port `8080:80`.
  - `sounds` (Profil `tools`): Node-Container, `env_file: .env`, schreibt nach `public/sounds/`. Aufruf `docker compose run --rm sounds`.
- `.env` bleibt lokal (in `.gitignore` und `.dockerignore`). Im Repo liegt nur `.env.example` mit `ELEVENLABS_API=`.
- Mikrofon funktioniert nur in einem sicheren Kontext: `localhost` reicht. Zugriff von anderen Geräten bräuchte HTTPS (nicht in v1).

## 11. Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| Mikrofon verweigert/fehlt | Lektionen gesperrt, Theorie und Freies Üben ohne Bewertung nutzbar (siehe 4), Banner mit Anleitung |
| AudioContext blockiert (Autoplay) | Start erst nach Klick auf "Los" |
| Samples laden nicht | Fehler-Screen mit "Erneut versuchen" |
| Audiogerät wechselt | Übung pausiert, Neukalibrierung vorgeschlagen |
| Tab verliert Sichtbarkeit während Übung | Übung bricht ab (Timing unzuverlässig), Neustart möglich |
| AudioWorklet nicht unterstützt | Hinweis auf aktuellen Chrome/Firefox/Safari |
| Speicherstand defekt | Backup-Export anbieten, dann zurücksetzen |
| Kopfhörer-Check fehlgeschlagen | Warnung, Fortfahren nur mit Bestätigung, Ergebnisse markiert |

## 12. Tests und Abnahme

- **Unit-Tests (Vitest):** `expectedEvents` für alle Unterteilungen, Zeitfenster, DP-Zuordnung (Randfälle: zu viele/zu wenige Einsätze, Doppel-Einsätze), Score, Akzente, Tendenz, Fortschrittsregeln (Freischalten, Stufen, XP, Streak über Mitternacht, Tagesziel, Schwachstellen-EMA, Wiedereinreihen), Speicher-Migrationen.
- **Content-Validierung (Vitest):** jedes Pattern hat 4 Beats pro Takt, `cells.length === div`, Gruppen summieren auf die Zellenzahl, jede Silbe existiert im Sound-Manifest, jede Lektion referenziert existierende Patterns.
- **Einsatz-Erkennung offline:** synthetische Aufnahmen aus den Samples mit bekannten Zeitpunkten plus Rauschen, sowie echte Takes von Luca aus der Debug-Ansicht. **Ziel: Median-Fehler < 10 ms, ≥ 95 % der Silben erkannt, ≤ 3 % Fehl-Einsätze** bei 16teln bis 120 BPM.
- **E2E (Playwright, Chromium mit simuliertem Mikrofon aus WAV):** Kalibrierung, eine komplette Lektion bis zum Abschluss, Mikrofon verweigert.
- **Manuell:** Phase-2-Abnahme durch Luca mit eigener Stimme in der Debug-Ansicht.

## 13. Bauphasen

1. **Gerüst:** Vite/React/TS, Tailwind, Design-Tokens, Docker + Compose, Sound-Skript mit Stimmwahl, Sounds generieren und committen.
2. **Audio-Kern:** Engine, Scheduler, Klick, Mikrofon, Onset-Worklet, Kalibrierung, Debug-Ansicht. **Abnahme durch Luca** bevor es weitergeht.
3. **Bewertung + Übungstypen:** Domain-Logik (Zuordnung, Score, Akzente, Tendenz), die vier Übungstypen, Auswertung, Raster linear/zyklisch, Notenschrift.
4. **Pfad + Spielmechanik:** Startseite, Lektionsablauf, XP, Stufen, Freischalten, Streak, Tagesziel, Speicher.
5. **Inhalte:** Units 1 bis 4, Theorie-Karten, Checkpoints.
6. **Extras + Feinschliff:** Freies Üben, Schwachstellen, Einstellungen, Export/Import, Dark Mode, E2E-Tests.

## 14. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Einsatz-Erkennung zu ungenau (Raum, Mikrofon) | Phase 2 zuerst, Debug-Ansicht, Offline-Tests mit echten Takes, einstellbare Toleranz |
| P-Center unterscheidet sich je Silbe und Sprecher | Offset-Tabelle pro Silbe, Validierung mit Lucas Takes |
| ElevenLabs-Einzelsilben klingen unnatürlich | mehrere Takes, Trägerphrasen-Fallback, Stimmwahl |
| Ausgabeformat/Modell abhängig vom ElevenLabs-Abo | bei Umsetzung gegen API-Doku prüfen, Node-Nachbearbeitung als Fallback |
| Bluetooth-Latenz schwankt | Warnung ab 120 ms, Empfehlung Kabel |
