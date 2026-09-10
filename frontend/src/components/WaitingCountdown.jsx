// Locked/waiting content shown when attendance/absence submissions are closed.
//
// Same centered pattern as the submit-success screens: small icon box,
// header, then small description lines (opening info, live countdown,
// daily open window). Rendered inside a centered <main> by the caller.

// Locked/waiting content shown when attendance/absence submissions are closed.
//
// Same centered pattern as the submit-success screens: small icon box,
// header, then a single description line with the live countdown and the
// daily open window. Rendered inside a centered <main> by the caller.

import { useMemo } from 'react'
import { Icon } from '@gravity-ui/uikit'
import { TriangleExclamation } from '@gravity-ui/icons'

function toMinutes(t) {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

function shortHM(mins) {
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

export default function WaitingCountdown({ title, settings, countdownText }) {
  const windowShort = useMemo(() => {
    const openTime = settings?.attendance_open_time || settings?.open_time || '06:00'
    const closeTime = settings?.attendance_close_time || settings?.close_time || '21:00'
    const openMins = toMinutes(openTime)
    const closeMins = toMinutes(closeTime)
    if (openMins === null || closeMins === null) return null
    return `${shortHM(openMins)} to ${shortHM(closeMins)}`
  }, [settings])

  // countdownText arrives as "Opens in 4h 2m" (or a fallback sentence).
  const raw = (countdownText || '').trim()
  const match = /^opens in\s+/i.exec(raw)
  const sentence = match
    ? `It will open in ${raw.slice(match[0].length).trim()}`
    : raw || 'It will open soon'

  return (
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
        <Icon data={TriangleExclamation} size={32} className="text-neutral-900 dark:text-neutral-100" />
      </div>
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
        {title} is Closed
      </h1>
      <p className="mt-2 max-w-[280px] text-center text-sm text-neutral dark:text-neutral-400">
        {sentence}
        {windowShort ? `, ${title.toLowerCase()} is open daily from ${windowShort}` : ''}
      </p>
    </div>
  )
}
