// Date helpers for the "Daftar Hadir Peserta Didik" recap.
//
// The recap's print layout (see absensi_template.html) is built out of
// fixed-width blocks: whichever weekdays are selected as "work days" (e.g.
// Senin-Sabtu by default), repeated twice per block (two weeks), two blocks
// per page. The admin picks a start/end date range plus which weekdays
// count as work days here; the server is responsible for chunking that
// range into blocks/pages and for rendering the day-column grid accordingly
// (see backend contract). These helpers only support the date-range/preview
// UI itself -- the server's counts are authoritative.

import { format, isAfter, addDays, startOfDay } from 'date-fns'

// Default working days, Senin-Sabtu, using the same 0=Minggu..6=Sabtu
// convention as JS Date#getDay() (and what the backend's `work_days` query
// param expects).
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
]

const BLOCKS_PER_PAGE = 2

export function formatShortDate(date) {
  return format(date, 'dd/MM/yyyy')
}

export function toDateKey(date) {
  return format(date, 'yyyy-MM-dd')
}

/** Parses a variety of likely date formats coming back from the API. */
export function parseApiDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && String(value).trim() !== '' && String(asNumber).length >= 10) {
    // Unix timestamp (seconds or ms)
    const ms = String(asNumber).length > 11 ? asNumber : asNumber * 1000
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Counts selected work days between two 'yyyy-MM-dd' date-key strings,
 * inclusive on both ends. `workDays` is a list of JS Date#getDay() values
 * (0=Minggu..6=Sabtu); defaults to Senin-Sabtu. Used only to preview how
 * many pages a recap will produce -- the server does the authoritative
 * chunking.
 */
export function countWorkingDays(startDateKey, endDateKey, workDays = DEFAULT_WORK_DAYS) {
  if (!startDateKey || !endDateKey) return 0
  const start = startOfDay(new Date(`${startDateKey}T00:00:00`))
  const end = startOfDay(new Date(`${endDateKey}T00:00:00`))
  if (isAfter(start, end)) return 0

  const workDaySet = new Set(workDays && workDays.length > 0 ? workDays : DEFAULT_WORK_DAYS)

  let count = 0
  let cursor = start
  while (!isAfter(cursor, end)) {
    if (workDaySet.has(cursor.getDay())) count += 1
    cursor = addDays(cursor, 1)
  }
  return count
}

/**
 * Estimated page count for a given working-day count (min. 1), given how
 * many weekdays are selected as work days (each block = 2x that many
 * columns, two blocks per page).
 */
export function estimatePageCount(workingDays, workDaysCount = DEFAULT_WORK_DAYS.length) {
  const perWeek = Math.max(1, workDaysCount)
  const perBlock = perWeek * 2
  const perPage = perBlock * BLOCKS_PER_PAGE
  return Math.max(1, Math.ceil(workingDays / perPage))
}
