// Date helpers for building the two-week (12 working-day) attendance window
// used by the "Daftar Hadir Peserta Didik" recap, matching the uploaded CSV
// template (Senin–Sabtu, twice).

import { addDays, startOfWeek, format, isAfter, isSameDay, startOfDay } from 'date-fns'

export const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/**
 * Given any date within the first week of the desired period, returns the 12
 * working days (Mon–Sat, twice) that make up the two-week attendance window.
 */
export function getTwoWeekWindow(anchorDate) {
  const monday = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const days = []
  for (let week = 0; week < 2; week += 1) {
    for (let d = 0; d < 6; d += 1) {
      days.push(addDays(monday, week * 7 + d))
    }
  }
  return days
}

export function formatShortDate(date) {
  return format(date, 'dd/MM')
}

export function formatDayLabel(date) {
  return `${DAY_NAMES_ID[date.getDay()]} ${formatShortDate(date)}`
}

export function isFutureDay(date) {
  return isAfter(startOfDay(date), startOfDay(new Date()))
}

export function isSameCalendarDay(a, b) {
  return isSameDay(a, b)
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
