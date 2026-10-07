import SecuritySettings from '../../components/SecuritySettings.jsx'

export default function AdminSecurity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Security</h1>
        <p className="mt-1 max-w-2xl text-xs text-neutral dark:text-neutral-400">
          Two-factor authentication for your own admin account. It cannot be applied to other admins.
        </p>
      </div>
      <div data-guide="security-panel">
        <SecuritySettings apiBase="/api/admin" />
      </div>
    </div>
  )
}
