import { useNavigate } from 'react-router-dom'
import { Icon } from '@gravity-ui/uikit'
import { ArrowLeft } from '@gravity-ui/icons'
import SecuritySettings from '../components/SecuritySettings.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function TwoFactor() {
  const navigate = useNavigate()

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-6 pb-[60px]">
      <header className="flex items-center justify-between gap-4 py-4 pt-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/main')}
            aria-label="Back to home"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Icon data={ArrowLeft} size={18} />
          </button>
          <h1 className="text-xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
            Authentication Security
          </h1>
        </div>
        <ThemeToggle className="h-9 w-9 rounded-full" />
      </header>

      <div className="mt-2">
        <SecuritySettings apiBase="/api/user" />
      </div>
    </main>
  )
}
