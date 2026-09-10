const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function urlBase64ToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getVapidPublicKey() {
  const res = await fetch('/api/all/push-public-key', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load push configuration')
  const data = await res.json()
  const key = data?.publicKey
  if (!key) throw new Error('Push notifications are not configured on the server')
  return key
}

async function getRegistration() {
  return navigator.serviceWorker.register('/service-worker.js')
}

// Subscribes this browser for push and stores the subscription server-side,
// replacing any previous device (one device per user). Resolves true when
// the browser permission was granted and the subscription saved.
export async function subscribePush() {
  if (!pushSupported()) throw new Error('Push notifications are not supported in this browser')

  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked. Please allow them in your browser settings.')
  }
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') throw new Error('Notification permission was not granted')
  }

  const registration = await getRegistration()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const vapidKey = await getVapidPublicKey()
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const res = await fetch('/api/user/push-subscription', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      auth: bufferToBase64Url(subscription.getKey('auth')),
      p256dh: bufferToBase64Url(subscription.getKey('p256dh')),
    }),
  })
  if (!res.ok) throw new Error('Failed to save push subscription')
  return true
}

export async function unsubscribePush() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
    } catch {
      // Continue with server-side cleanup even if the local part fails.
    }
  }
  const res = await fetch('/api/user/push-subscription', {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to remove push subscription')
  return true
}

// Whether the server holds a push subscription for the current user.
export async function getPushEnabled() {
  const res = await fetch('/api/user/push-subscription/status', { credentials: 'include' })
  if (!res.ok) return false
  const data = await res.json()
  return Boolean(data?.enabled)
}
