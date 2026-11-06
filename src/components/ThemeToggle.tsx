import { useState } from 'react'
import { getTheme, setThemePref } from '../pages/Settings'

/** سوئیچ سریع روشن/تیره */
export function ThemeToggle({ block }: { block?: boolean }) {
  const [theme, setTheme] = useState(getTheme)
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  function toggle() {
    const t = dark ? 'light' : 'dark'
    setThemePref(t)
    setTheme(t)
  }
  return (
    <button type="button" className={`btn sm ${block ? 'block' : ''}`} onClick={toggle} aria-label="تغییر پوسته">
      {dark ? '☀️ پوسته روشن' : '🌙 پوسته تیره'}
    </button>
  )
}
