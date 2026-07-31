// Date helpers for the "Daftar Hadir Peserta Didik" recap.
//
// The recap's print layout (see absensi_template.html) is built out of
// fixed 12-working-day blocks (Senin–Sabtu, twice = one block), two blocks
// per page. The admin only picks a start/end date range here; the server is
// responsible for chunking that range into blocks/pages and for always
// rendering the full 12-column grid per block (see backend contract).
// These helpers only support the date-range picker UI itself.

import { format, isAfter, addDays, startOfDay } from 'date-fns'

const WORKING_DAYS_PER_BLOCK = 12 // Senin–Sabtu x2
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
 * Counts working days (Senin–Sabtu, i.e. everything except Minggu/Sunday)
 * between two 'yyyy-MM-dd' date-key strings, inclusive on both ends. Used
 * only to preview how many pages a recap will produce — the server does
 * the authoritative chunking.
 */
export function countWorkingDays(startDateKey, endDateKey) {
  if (!startDateKey || !endDateKey) return 0
  const start = startOfDay(new Date(`${startDateKey}T00:00:00`))
  const end = startOfDay(new Date(`${endDateKey}T00:00:00`))
  if (isAfter(start, end)) return 0

  let count = 0
  let cursor = start
  while (!isAfter(cursor, end)) {
    if (cursor.getDay() !== 0) count += 1 // 0 = Minggu/Sunday, excluded
    cursor = addDays(cursor, 1)
  }
  return count
}

/** Estimated page count for a given working-day count (min. 1). */
export function estimatePageCount(workingDays) {
  const perPage = WORKING_DAYS_PER_BLOCK * BLOCKS_PER_PAGE
  return Math.max(1, Math.ceil(workingDays / perPage))
}