import { useContext, useLayoutEffect, useMemo, useState } from 'react'
import { ViewTransition } from 'react'
import { ThemeContext, applyThemeColor, getInitialTheme, saveTheme } from './useTheme.js'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  // Layout effect, not passive effect: React runs it inside the view
  // transition update callback, before snapshots are taken. A passive
  // effect would flip <html> after the new snapshot and break dark→light.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    applyThemeColor(theme)
    saveTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// Boundary for the theme wipe. The theme class lives on this div (a real
// render-phase DOM mutation inside the boundary) so the new snapshot
// actually differs; a class set in useEffect would land after the snapshot
// and the wipe would run over identical images. No `name` prop (docs: names
// are only for shared-element transitions) and no default="none" (its
// gating paths are buggy in this release) - just the update class.
export function ThemeViewTransition({ children }) {
  const { theme } = useContext(ThemeContext)
  const dark = theme === 'dark'
  return (
    <ViewTransition update={{ default: 'none', theme: 'theme-wipe' }}>
      <div className={dark ? 'dark min-h-dvh bg-[#0a0a0a]' : 'light min-h-dvh bg-white'}>{children}</div>
    </ViewTransition>
  )
}
