import { createContext, useContext } from 'react'

const THEME_STORAGE_KEY = 'takota-theme'

// Resolve the initial theme: an explicitly saved choice wins, otherwise we
// follow the OS preference. This also runs before first paint via
// ThemeProvider's lazy initializer, so there is no light-mode flash for
// users who picked dark.
export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore storage failures
  }
}

export const ThemeContext = createContext(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
