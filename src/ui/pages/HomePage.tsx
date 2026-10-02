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
