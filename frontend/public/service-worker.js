// No-op fetch handler so the app meets the PWA installability criteria.
// Requests pass through to the network untouched.
self.addEventListener('fetch', () => {})

/* global clients:readonly */
// Service Worker for push notifications and PWA installability.
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'takota-notification',
    requireInteraction: data.requireInteraction || false,
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Close',
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Takota', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'close') {
    return
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

self.addEventListener('notificationclose', () => {
  // Handle notification close (no-op, kept for future analytics)
})
