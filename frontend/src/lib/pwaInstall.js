import { useCallback, useEffect } from 'react'
import { useSyncExternalStore } from 'react'

// Module-level store so components that mount after `beforeinstallprompt`
// fired (e.g. the mobile drawer button) still see the deferred prompt.
let snapshot = {
  deferredPrompt: null,
  installedAsApp: typeof window !== 'undefined' && isRunningAsApp(),
}
const listeners = new Set()

function setStore(patch) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot() {
  return snapshot
}

// True when the page runs inside the installed PWA (standalone display
// mode, including iOS Safari's navigator.standingalone).
export function isRunningAsApp() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  } catch {
    // matchMedia unavailable - fall through to the iOS check
  }
  return window.navigator?.standalone === true
}

let listening = false
function ensureListening() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setStore({ deferredPrompt: e })
  })
  window.addEventListener('appinstalled', () => {
    setStore({ deferredPrompt: null, installedAsApp: true })
  })
  window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', () => {
    if (isRunningAsApp()) setStore({ deferredPrompt: null, installedAsApp: true })
  })
}

// Tracks the browser's PWA install prompt. canInstall is true only while
// the app is installable but not yet installed/running as the PWA.
export function usePwaInstall() {
  ensureListening()
  const { deferredPrompt, installedAsApp } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    // Re-check standalone on mount (covers bfcache restores).
    if (isRunningAsApp() && !snapshot.installedAsApp) {
      setStore({ deferredPrompt: null, installedAsApp: true })
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setStore({ deferredPrompt: null, installedAsApp: true })
      return true
    }
    return false
  }, [deferredPrompt])

  return { canInstall: Boolean(deferredPrompt) && !installedAsApp, promptInstall }
}
