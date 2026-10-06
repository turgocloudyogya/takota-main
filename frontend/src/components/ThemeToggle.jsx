import { addTransitionType, startTransition } from 'react'
import { Icon } from '@gravity-ui/uikit'
import { Moon, Sun } from '@gravity-ui/icons'
import { useTheme } from '../lib/useTheme.js'

// Sun/Moon switch shared by the user pages and the admin sidebar. Follows
// the surrounding UI's neutral-tone icon-button language. The theme state
// flips inside startTransition so <ViewTransition name="theme-wipe"> in
// main.jsx animates the circular wipe from this button.
export default function ThemeToggle({ className = '', ...rest }) {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'

  function handleToggle(e) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const x = e.clientX ?? window.innerWidth - 24
    const y = e.clientY ?? 24
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const root = document.documentElement
    root.style.setProperty('--tx', `${x}px`)
    root.style.setProperty('--ty', `${y}px`)
    root.style.setProperty('--tr', `${r}px`)
    // Freeze every other animation while the themes cross over.
    root.classList.add('vt-lock')
    setTimeout(() => root.classList.remove('vt-lock'), 1100)
    startTransition(() => {
      addTransitionType('theme')
      setTheme(next)
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={dark ? 'Enable light mode' : 'Enable dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-primary active:scale-90 dark:text-neutral-400 dark:hover:bg-neutral-800 ${className}`}
      {...rest}
    >
      <Icon data={dark ? Sun : Moon} size={16} />
    </button>
  )
}
