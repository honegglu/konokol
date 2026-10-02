# taka · Konnakol-Trainer

Eine Lern-Webapp im Duolingo-Stil, um **Konnakol** zu lernen, die südindische Kunst, Rhythmen zu sprechen. Gedacht als Rhythmus-Werkzeug für Musiker: Unterteilungen, Pausen und Gruppierungen über 4/4 sprechen und dabei präziser im Timing werden.

Die App spricht Silben vor (Ta, Ta-ka, Ta-ki-ta, Ta-ka-di-mi, …), hört über das Mikrofon zu und bewertet **pro Silbe**, ob du im Timing bist und ab Unit 4 auch, ob die Akzente sitzen.

> **Status:** Design abgestimmt, Umsetzung startet. Details in der [Design-Spec](docs/superpowers/specs/2026-10-02-konnakol-trainer-design.md).
> "taka" ist ein Arbeitstitel.

## Was die App können soll (v1)

- **Lernpfad** mit 4 Units: Silben & Puls, Unterteilungen (3, 5, 6, 7), Pausen & Lücken, Gruppierungen über 4/4
- **Vier Übungstypen:** Hör-Quiz, Mitsprechen mit Ausblenden, Nachsprechen, Vom Blatt sprechen
- **Mikrofon-Bewertung** mit Latenz-Kalibrierung: Timing pro Silbe, Akzente, Tendenz-Hinweis ("Du eilst beim 'ka' um ca. 30 ms"), eigene Aufnahme anhören
- **Tempo-Stufen** pro Lektion, XP, Streak und Tagesziel in Minuten
- **Schwachstellen-Training** und **Freies Üben** mit frei wählbarem Tempo
- Rhythmus-Raster **linear oder als Kreis**, dazu optional westliche **Notenschrift**
- Hell- und Dunkel-Modus

## Voraussetzungen

- Docker (mit Compose)
- Kopfhörer, am besten kabelgebunden (Bluetooth hat zu viel Latenz für Timing-Bewertung)
- Ein aktueller Desktop-Browser (Chrome, Firefox oder Safari)
- Für die Sound-Generierung: ein [ElevenLabs](https://elevenlabs.io)-API-Key

## Starten

> Die folgenden Befehle funktionieren, sobald Phase 1 der Umsetzung steht.

```bash
# App bauen und starten, danach http://localhost:8080 öffnen
docker compose up --build
```

Das Mikrofon funktioniert nur über `localhost` oder HTTPS. Für die lokale Nutzung reicht `localhost`.

### Sounds neu generieren (optional)

Die gesprochenen Silben und UI-Sounds werden einmalig mit ElevenLabs erzeugt und liegen fertig im Repo unter `public/sounds/`. Neu generieren musst du sie nur, wenn sich Stimme oder Silben ändern:

```bash
cp .env.example .env   # dann ELEVENLABS_API eintragen
docker compose run --rm sounds
```

Der API-Key wird nur von diesem Skript gelesen. Er landet weder im Browser noch im Docker-Image.

## Technik

Vite, React, TypeScript, Tailwind CSS v4, Web Audio API (AudioWorklet für die Einsatz-Erkennung), VexFlow für Notenschrift, Vitest und Playwright für Tests, nginx im Container.

```
src/
  content/   Silben, Patterns, Lektionen, Theorie (reine Daten)
  domain/    Bewertung, Fortschritt, Lektionsablauf (reine Logik, ohne Browser)
  audio/     Wiedergabe, Mikrofon, Einsatz-Erkennung, Kalibrierung
  storage/   Speicherstand (localStorage, später austauschbar)
  ui/        Screens und Komponenten
tools/       Sound-Generierung mit ElevenLabs
docs/        Design-Spec und Pläne
```

## Silben auf einen Blick

| Grösse | Silben | Westlich |
|---|---|---|
| 1 | Ta | Viertel |
| 2 | Ta-ka | Achtel |
| 3 | Ta-ki-ta | Triolen |
| 4 | Ta-ka-di-mi | 16tel |
| 5 | Ta-di-gi-na-thom | Quintolen |
| 6 | Ta-ki-ta-Ta-ki-ta | Sextolen |
| 7 | Ta-ki-ta-Ta-ka-di-mi | Septolen |
