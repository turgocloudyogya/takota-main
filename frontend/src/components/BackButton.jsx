import { useNavigate } from 'react-router-dom'
import { Icon } from '@gravity-ui/uikit'
import { ChevronLeft } from '@gravity-ui/icons'
import ThemeToggle from './ThemeToggle.jsx'

// Shared "back" navigation button used across user pages. Without `label` it
// renders a compact icon-only round button (e.g. page headers); with `label`
// it renders a pill with the chevron next to the page name. Falls back to
// history back, or navigates to `to`/runs `onClick` when provided.
//
// The theme toggle rides along by default (`themeToggle`), so every user
// page header gets it for free; the trailing spacer keeps it pinned right.
export default function BackButton({ label, to, onClick, className = '', themeToggle = true }) {
  const navigate = useNavigate()

  function handleClick() {
    if (onClick) {
      onClick()
    } else if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }

  return (
    <>
      {label ? (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex cursor-pointer items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 active:scale-[0.97] dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 ${className}`}
        >
          <Icon data={ChevronLeft} size={18} />
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Back"
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.94] dark:text-neutral-100 dark:hover:bg-neutral-800 ${className}`}
        >
          <Icon data={ChevronLeft} size={20} />
        </button>
      )}
      {themeToggle && (
        <>
          <span className="flex-1" aria-hidden="true" />
          <ThemeToggle className="h-8 w-8 shrink-0 rounded-full" />
        </>
      )}
    </>
  )
}
