// GitHub-style activity heatmap for attendance.
//
// Each column is a week (Mon-Sun rows). Color buckets:
// 0 gray (empty/closed), 1 red (below 5% present, or leave only),
// 2 orange (5-49%), 3 yellow (50-79%), 4 light green (80-99%),
// 5 dark green (100% present), 6 dark orange (lone reporter).
// Hovering a cell shows present/leave/unreported/alpha percentages.

import { useMemo, useState } from 'react'

const LEVEL_CLASSES = {
  0: 'bg-neutral-200 dark:bg-neutral-700',
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-400',
  4: 'bg-green-400',
  5: 'bg-green-700',
  6: 'bg-orange-700',
}

// Pale filler for padding cells and upcoming (future) days.
const PADDING_CLASS = 'bg-neutral-100 dark:bg-neutral-800'

function cellClass(day) {
  if (day.future) return PADDING_CLASS
  return LEVEL_CLASSES[day.level] ?? LEVEL_CLASSES[0]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthShort(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })
}

function formatDayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ActivityHeatmap({ days, showDetails = true }) {
  const [hovered, setHovered] = useState(null)

  const weeks = useMemo(() => {
    if (!days || days.length === 0) return []
    // Pad the front so the first column starts on Monday (row 0).
    const first = new Date(`${days[0].date}T12:00:00`)
    const lead = (first.getDay() + 6) % 7
    const cells = [...Array(lead).fill(null), ...days]
    const out = []
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7))
    }
    return out
  }, [days])

  if (!days || days.length === 0) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">No activity data yet</p>
    )
  }

  const lastDate = days.length > 0 ? days[days.length - 1].date : null

  // Month label per week column: shown when the month changes.
  const monthLabels = weeks.map((week) => {
    const first = week.find((d) => d !== null)
    return first ? monthShort(first.date) : null
  })
  let lastMonth = null

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-fit gap-1">
          <div className="flex flex-col gap-1">
            <span className="h-4 w-8" />
            {WEEKDAYS.map((name) => (
              <span
                key={name}
                className="flex h-4 w-8 items-center text-[9px] text-neutral-500 dark:text-neutral-500"
              >
                {name}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const month = monthLabels[wi]
            const showMonth = month !== null && month !== lastMonth
            lastMonth = month
            return (
              <div key={wi} className="flex flex-col gap-1">
                <span className="h-4 w-4 overflow-visible whitespace-nowrap text-[9px] leading-4 text-neutral-500 dark:text-neutral-500">
                  {showMonth ? month : ''}
                </span>
                {week.map((day, di) =>
                  day === null ? (
                    <span key={di} className={`h-4 w-4 rounded-[4px] ${PADDING_CLASS}`} />
                  ) : (
                    <button
                      key={di}
                      type="button"
                      aria-label={`${day.date}: ${day.present_pct.toFixed(0)}% present`}
                      onMouseEnter={() => setHovered(day.date)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(day.date)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setHovered(day.date)}
                      className={`h-4 w-4 rounded-[4px] ${cellClass(day)}`}
                    />
                  ),
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className={`mt-2 flex items-center gap-2 ${showDetails ? 'justify-between' : 'justify-end'}`}>
        {showDetails && (
          <p className="min-h-5 flex-1 text-xs text-neutral-600 dark:text-neutral-400">
            {hovered
              ? (() => {
                const d = days.find((x) => x.date === hovered)
                if (!d) return ''
                if (d.future) return `${formatDayLabel(d.date)} · Upcoming`
                if (d.closed) return `${formatDayLabel(d.date)} · Day off`
                const restLabel =
                  d.date === lastDate
                    ? `${d.unreported_pct.toFixed(0)}% unreported`
                    : `${d.alpha_pct.toFixed(0)}% alpha`
                return `${formatDayLabel(d.date)} · ${d.present_pct.toFixed(0)}% present · ${d.leave_pct.toFixed(0)}% leave · ${restLabel}`
              })()
              : 'Hover a square for details'}
          </p>
        )}
        <div className="flex shrink-0 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          <span>Less</span>
          {[0, 1, 2, 3, 6, 4, 5].map((l) => (
            <span key={l} className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASSES[l]}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
