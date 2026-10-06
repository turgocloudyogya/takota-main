import BackButton from '../components/BackButton.jsx'
import SecuritySettings from '../components/SecuritySettings.jsx'

export default function TwoFactor() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-6 pb-[60px]">
      <header className="flex h-[60px] w-full items-center justify-between gap-3">
        <BackButton label="Authentication Security" to="/main" />
      </header>

      <div className="mt-2">
        <SecuritySettings apiBase="/api/user" />
      </div>
    </main>
  )
}
