import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Bell, BellSlash } from '@gravity-ui/icons'
import { getPushEnabled, pushSupported, subscribePush, unsubscribePush } from '../lib/push.js'

export default function PushNotifications() {
  const [supported] = useState(() => pushSupported())
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  )

  useEffect(() => {
    let cancelled = false
    async function checkStatus() {
      try {
        setEnabled(await getPushEnabled())
      } catch (err) {
        console.error('Failed to check notification status:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (supported) checkStatus()
    else setLoading(false)
    return () => {
      cancelled = true
    }
  }, [supported])

  async function handleEnable() {
    try {
      setLoading(true)
      await subscribePush()
      setPermission(Notification.permission)
      toast.success('Push notifications enabled!')
      setEnabled(true)
    } catch (err) {
      setPermission(Notification.permission)
      toast.error(err.message || 'Failed to enable push notifications')
      console.error('Push notification error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    try {
      setLoading(true)
      await unsubscribePush()
      toast.success('Push notifications disabled')
      setEnabled(false)
    } catch (err) {
      toast.error(err.message || 'Failed to disable push notifications')
      console.error('Unsubscribe error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-500/10">
        <p className="text-sm text-yellow-900 dark:text-yellow-200">
          Push notifications are not supported in your browser.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
        <div className="flex items-start gap-3">
          <Icon
            data={enabled ? Bell : BellSlash}
            size={20}
            className={enabled ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'}
          />
          <div className="flex-1">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">Push Notifications</p>
            <p className={`text-sm ${
              enabled
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}>
              {enabled ? 'Enabled' : 'Disabled'}
            </p>
            {enabled && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                You&apos;ll receive a reminder before attendance closes, a notice if you miss it,
                and updates when absence requests are approved or rejected.
              </p>
            )}
          </div>
        </div>
      </div>

      {permission === 'denied' && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
          <p className="text-sm text-red-900 dark:text-red-200">
            <strong>Notifications are blocked.</strong> Please enable notifications in your browser settings to use this feature.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={enabled ? handleDisable : handleEnable}
        disabled={loading || permission === 'denied'}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
          enabled
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <Icon data={enabled ? BellSlash : Bell} size={16} />
        {loading ? 'Loading...' : enabled ? 'Disable Notifications' : 'Enable Notifications'}
      </button>
    </div>
  )
}
