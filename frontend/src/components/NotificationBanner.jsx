import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Bell, Xmark } from '@gravity-ui/icons'
import { getPushEnabled, pushSupported, subscribePush } from '../lib/push.js'

const DISMISSED_KEY = 'takota-notif-banner-dismissed'

// Opt-in banner recommending push notifications for attendance reminders.
// Dismissible and never forced: it only shows while the browser permission
// is still undecided, the banner was not dismissed, and the server holds
// no subscription for this user.
export default function NotificationBanner() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        if (!pushSupported()) return
        if (Notification.permission !== 'default') return
        if (localStorage.getItem(DISMISSED_KEY) === '1') return
        if (await getPushEnabled()) return
        if (!cancelled) setVisible(true)
      } catch {
        // Never block the page when the push check fails.
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // ignore storage failures
    }
    setVisible(false)
  }

  async function handleAllow() {
    try {
      setLoading(true)
      await subscribePush()
      toast.success('Notifications enabled! You will get attendance reminders on this device.')
      setVisible(false)
    } catch (err) {
      toast.error(err.message || 'Failed to enable notifications')
      // Permission resolved (granted-but-failed or denied): stop nagging.
      if (Notification.permission !== 'default') setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon data={Bell} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Please enable notifications on this application, for attendance reminders (recommended)
          </p>
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
            We will remind you before attendance closes, and only on this device.
          </p>
          <button
            type="button"
            onClick={handleAllow}
            disabled={loading}
            className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Enabling...' : 'Allow'}
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification suggestion"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <Icon data={Xmark} size={14} />
        </button>
      </div>
    </div>
  )
}
