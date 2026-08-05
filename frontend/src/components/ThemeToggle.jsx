import { Icon } from '@gravity-ui/uikit'
import { Moon, Sun } from '@gravity-ui/icons'
import { useTheme } from '../lib/useTheme.js'

// Sun/Moon switch shared by the user pages and the admin sidebar. Follows
// the surrounding UI's neutral-tone icon-button language.
export default function ThemeToggle({ className = '', ...rest }) {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Enable light mode' : 'Enable dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-primary dark:text-neutral-400 dark:hover:bg-neutral-800 ${className}`}
      {...rest}
    >
      <Icon data={dark ? Sun : Moon} size={16} />
    </button>
  )
}
