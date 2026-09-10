import { createContext, useContext } from 'react'

const THEME_STORAGE_KEY = 'takota-theme'

// Browser chrome (address bar) color follows the page theme.
const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' }

export function applyThemeColor(theme) {
  try {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.light)
  } catch {
    // ignore (e.g. no DOM during prerender)
  }
}

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
