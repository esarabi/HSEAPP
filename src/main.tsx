import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getTheme } from './pages/Settings.tsx'
import { ensureBuiltinData } from './db/seed.ts'

void ensureBuiltinData().catch((e) => console.error('seed failed', e))
applyTheme(getTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
