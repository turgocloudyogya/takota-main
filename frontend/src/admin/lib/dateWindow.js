// Date helpers for the "Daftar Hadir Peserta Didik" recap.
//
// The recap's print layout (see attendanceReportHtml.js) is built out of
// working-day blocks (the selected weekdays, repeated twice = one block),
// two blocks per page. The admin picks a start/end date range *and* which
// weekdays count as working days here; the server is responsible for
// chunking that range into blocks/pages and for rendering a grid sized to
// match the selected weekdays (see backend contract). These helpers only
// support the date-range/weekday picker UI itself.

import { format, isAfter, addDays, startOfDay } from 'date-fns'

const BLOCKS_PER_PAGE = 2

// ISO weekday numbers (Senin=1..Minggu=7), matching the backend's
// `working_days` query param and default.
export const WEEKDAY_OPTIONS = [
  { iso: 1, label: 'Senin', short: 'Sen' },
  { iso: 2, label: 'Selasa', short: 'Sel' },
  { iso: 3, label: 'Rabu', short: 'Rab' },
  { iso: 4, label: 'Kamis', short: 'Kam' },
  { iso: 5, label: 'Jumat', short: "Jum" },
  { iso: 6, label: 'Sabtu', short: 'Sab' },
  { iso: 7, label: 'Minggu', short: 'Min' },
]

// Default working days: Senin-Sabtu, matching the backend default and the
// original fixed 12-column (6 days x2) layout.
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6]

function isoWeekday(date) {
  const wd = date.getDay() // 0 = Minggu .. 6 = Sabtu
  return wd === 0 ? 7 : wd
}

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
 * Counts working days between two 'yyyy-MM-dd' date-key strings, inclusive
 * on both ends, restricted to the given set of ISO weekday numbers
 * (Senin=1..Minggu=7, defaults to Senin-Sabtu). Used only to preview how
 * many pages a recap will produce - the server does the authoritative
 * chunking.
 */
export function countWorkingDays(startDateKey, endDateKey, workingDays = DEFAULT_WORKING_DAYS) {
  if (!startDateKey || !endDateKey) return 0
  const start = startOfDay(new Date(`${startDateKey}T00:00:00`))
  const end = startOfDay(new Date(`${endDateKey}T00:00:00`))
  if (isAfter(start, end)) return 0

  const daySet = new Set(workingDays && workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS)

  let count = 0
  let cursor = start
  while (!isAfter(cursor, end)) {
    if (daySet.has(isoWeekday(cursor))) count += 1
    cursor = addDays(cursor, 1)
  }
  return count
}

/**
 * Estimated page count for a given working-day count and selected weekday
 * set (min. 1 page). Each block holds the selected weekdays twice, and each
 * page holds BLOCKS_PER_PAGE blocks.
 */
export function estimatePageCount(workingDays, selectedWeekdaysCount = DEFAULT_WORKING_DAYS.length) {
  const daysPerBlock = Math.max(1, selectedWeekdaysCount) * 2
  const perPage = daysPerBlock * BLOCKS_PER_PAGE
  return Math.max(1, Math.ceil(workingDays / perPage))
}