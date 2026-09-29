import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Analytics from './pages/Analytics'
import Channels from './pages/Channels'
import Cleanup from './pages/Cleanup'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/cleanup" element={<Cleanup />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/favorites" element={<Channels forcedStatus="favorite" />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
