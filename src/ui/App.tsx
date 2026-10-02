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
