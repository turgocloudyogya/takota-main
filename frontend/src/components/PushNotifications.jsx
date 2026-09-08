import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Bell, BellSlash, Check } from '@gravity-ui/icons'

export default function PushNotifications() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [permission, setPermission] = useState('default')

  useEffect(() => {
    checkSupport()
    checkStatus()
  }, [])

  function checkSupport() {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(isSupported)
  }

  async function checkStatus() {
    try {
      setLoading(true)

      // Check browser permission
      if ('Notification' in window) {
        setPermission(Notification.permission)
      }

      // Check if we have a subscription in the backend
      const response = await fetch('/api/user/push-subscription/status')
      if (response.ok) {
        const data = await response.json()
        setEnabled(data.data.enabled)
      }
    } catch (err) {
      console.error('Failed to check notification status:', err)
    } finally {
      setLoading(false)
    }
  }

  async function registerServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported')
      }

      const registration = await navigator.serviceWorker.register('/service-worker.js')
      return registration
    } catch (err) {
      console.error('Service Worker registration failed:', err)
      throw err
    }
  }

  async function subscribeToPushNotifications() {
    try {
      setLoading(true)

      // Request permission if not granted
      if (permission !== 'granted') {
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== 'granted') {
          throw new Error('Notification permission denied')
        }
      }

      // Register service worker
      const registration = await registerServiceWorker()

      // Get push subscription
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        // Create new subscription
        const vapidKey = 'YOUR_PUBLIC_VAPID_KEY' // Replace with actual key
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        })
      }

      // Send subscription to backend
      const subscriptionData = {
        endpoint: subscription.endpoint,
        auth: btoa(new Uint8Array(subscription.getKey('auth')).join(',')),
        p256dh: btoa(new Uint8Array(subscription.getKey('p256dh')).join(',')),
      }

      const response = await fetch('/api/user/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData),
      })

      if (!response.ok) throw new Error('Failed to register subscription')

      toast.success('Push notifications enabled!')
      setEnabled(true)
    } catch (err) {
      toast.error(err.message || 'Failed to enable push notifications')
      console.error('Push notification error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribeFromPushNotifications() {
    try {
      setLoading(true)

      // Unsubscribe from service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
        }
      }

      // Notify backend
      const response = await fetch('/api/user/push-subscription', {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to unregister subscription')

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
                You'll receive notifications 1 and 3 hours before attendance closes, and when absence requests are approved or rejected.
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
        onClick={enabled ? unsubscribeFromPushNotifications : subscribeToPushNotifications}
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
