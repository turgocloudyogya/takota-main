import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Bell, BellSlash } from '@gravity-ui/icons'
import { getPushEnabled, pushSupported, subscribePush, unsubscribePush } from '../lib/push.js'

async function getLocalSubscription() {
  try {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    const lookup = (async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.pushManager.getSubscription()
    })()
    return await Promise.race([lookup, timeout])
  } catch {
    return null
  }
}

// Header bell button: enables push on this device, or disables it by
// removing the subscription both server-side and in this browser.
// Note: browsers do not allow revoking the permission itself from code,
// so "disable" stops all notifications by deleting the subscription.
export default function NotificationToggle({ className = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-[0.96]' }) {
  const [state, setState] = useState('unknown') // unknown | on | off | blocked | unsupported
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!pushSupported()) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('blocked')
        return
      }
      try {
        const [serverOn, localSub] = await Promise.all([getPushEnabled(), getLocalSubscription()])
        if (!cancelled) {
          setState(serverOn && localSub && Notification.permission === 'granted' ? 'on' : 'off')
        }
      } catch {
        if (!cancelled) setState('off')
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggle() {
    if (loading) return
    if (state === 'blocked') {
      toast.info('Notifications are blocked. Allow them in your browser settings to enable.')
      return
    }
    try {
      setLoading(true)
      if (state === 'on') {
        await unsubscribePush()
        toast.success('Notifications disabled and removed from this device.')
        setState(Notification.permission === 'denied' ? 'blocked' : 'off')
      } else {
        await subscribePush()
        toast.success('Notifications enabled on this device.')
        setState('on')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update notifications')
      if (Notification.permission === 'denied') setState('blocked')
    } finally {
      setLoading(false)
    }
  }

  if (state === 'unsupported' || state === 'unknown') return null

  const enabled = state === 'on'
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      aria-label={enabled ? 'Disable notifications' : 'Enable notifications'}
      title={enabled ? 'Disable notifications' : 'Enable notifications'}
      className={`${className} ${
        enabled
          ? 'text-primary hover:bg-primary/10'
          : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
      } disabled:opacity-50`}
    >
      <Icon data={enabled ? Bell : BellSlash} size={18} />
    </button>
  )
}
