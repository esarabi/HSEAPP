import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme } from './pages/Settings.tsx'

applyTheme((localStorage.getItem('hse.theme') as 'auto' | 'light' | 'dark') ?? 'auto')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
