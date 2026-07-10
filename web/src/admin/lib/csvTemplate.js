// Builds the "Daftar Hadir Peserta Didik" (student attendance recap) CSV,
// matching the layout of the uploaded template
// (Format_Daftar_Hadir_Peserta_Didik_v3.csv):
//
//   Nama DU/DI   :
//   Alamat DU/DI :
//   No | Nama Peserta Didik | Hari dan Tanggal (Senin..Sabtu x2) | Jumlah (S/I/A)
//   ...student rows, chunked 6-per-block like the original...
//   Mengesahkan, / Instruktur DU/DI: / ttd / ....................
//
// Two exports are offered to the user:
//  - downloadBlankTemplate(): the exact original file, byte-for-byte, so
//    there's always a pristine copy available to print and fill by hand.
//  - buildFilledCsv(...): the same layout, pre-filled with real names,
//    dates, V/S/I marks and S/I/A totals computed from the app's attendance
//    + absence data for a chosen two-week period.

import { formatDayLabel, toDateKey, parseApiDate } from './dateWindow.js'

const ROWS_PER_BLOCK = 6

// Byte-exact copy of the uploaded template (base64), so the "download
// template" button always serves an unmodified copy for manual/paper use.
const BLANK_TEMPLATE_BASE64 =
  'TmFtYSBEVS9ESSAgICAgICAgICAgICAgICAgIDosLCwsLCwsLCwsLCwsLCwsDQpBbGFtYXQgRFUvREkgICAgICAgICAgICAgICAgOiwsLCwsLCwsLCwsLCwsLCwNCiwsLCwsLCwsLCwsLCwsLCwNCk5vLE5hbWEgUGVzZXJ0YSBEaWRpayxIYXJpIGRhbiBUYW5nZ2FsLCwsLCwsLCwsLCwsSnVtbGFoLCwNCiwsU2VuaW4sU2VsYXNhLFJhYnUsS2FtaXMsSnVtYXQsU2FidHUsU2VuaW4sU2VsYXNhLFJhYnUsS2FtaXMsSnVtYXQsU2FidHUsUyxJLEENCiwsLCwsLCwsLCwsLCwsLCwNCjEsLCwsLCwsLCwsLCwsLCwsDQoyLCwsLCwsLCwsLCwsLCwsLA0KMywsLCwsLCwsLCwsLCwsLCwNCjQsLCwsLCwsLCwsLCwsLCwsDQo1LCwsLCwsLCwsLCwsLCwsLA0KNiwsLCwsLCwsLCwsLCwsLCwNCk5vLE5hbWEgUGVzZXJ0YSBEaWRpayxIYXJpIGRhbiBUYW5nZ2FsLCwsLCwsLCwsLCwsSnVtbGFoLCwNCiwsU2VuaW4sU2VsYXNhLFJhYnUsS2FtaXMsSnVtYXQsU2FidHUsU2VuaW4sU2VsYXNhLFJhYnUsS2FtaXMsSnVtYXQsU2FidHUsUyxJLEENCiwsLCwsLCwsLCwsLCwsLCwNCjEsLCwsLCwsLCwsLCwsLCwsDQoyLCwsLCwsLCwsLCwsLCwsLA0KMywsLCwsLCwsLCwsLCwsLCwNCjQsLCwsLCwsLCwsLCwsLCwsDQo1LCwsLCwsLCwsLCwsLCwsLA0KNiwsLCwsLCwsLCwsLCwsLCwNCiwsLCwsLCwsLCwsLCwsLCwNCiIgICAgICAgICAgICBNZW5nZXNhaGthbiwiLCwsLCwsLCwsLCwsLCwsLA0KICAgICAgICAgICAgSW5zdHJ1a3R1ciBEVS9ESTosLCwsLCwsLCwsLCwsLCwsDQosLHR0ZCwsLCwsLCwsLCwsLCwsDQosLC4uhS4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4sLCwsLCwsLCwsLCwsLA0KLCwsLCwsLCwsLCwsLCwsLA0K'

function base64ToBlob(base64, type) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type })
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Downloads the pristine, unmodified attendance-sheet template. */
export function downloadBlankTemplate(
  filename = 'Format_Daftar_Hadir_Peserta_Didik.csv'
) {
  const blob = base64ToBlob(BLANK_TEMPLATE_BASE64, 'text/csv;charset=windows-1252')
  triggerDownload(blob, filename)
}

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvLine(cells) {
  return cells.map(csvEscape).join(',')
}

function padTo17(cells) {
  const out = cells.slice(0, 17)
  while (out.length < 17) out.push('')
  return out
}

const TABLE_HEADER_ROW_1 = () =>
  padTo17(['No', 'Nama Peserta Didik', 'Hari dan Tanggal', '', '', '', '', '', '', '', '', '', '', '', 'Jumlah'])

const TABLE_HEADER_ROW_2 = (days) =>
  padTo17(['', '', ...days.map((d) => formatDayLabel(d)), 'S', 'I', 'A'])

const BLANK_ROW = () => padTo17([])

/**
 * Computes each student's per-day mark (V/S/I/'') and S/I/A totals for the
 * given two-week window, from normalized attendance + absence records.
 *
 * @param {{id:string, name:string}[]} students
 * @param {import('./normalize.js').ReturnType} attendanceRecords - normalized attendance records
 * @param {Array} absenceRecords - normalized absence records
 * @param {Date[]} days - the 12 working days in the period
 */
export function computeAttendanceRecap(students, attendanceRecords, absenceRecords, days) {
  const attendanceByKey = new Map()
  attendanceRecords.forEach((rec) => {
    const dateObj = parseApiDate(rec.dateRaw)
    if (!rec.userId || !dateObj) return
    attendanceByKey.set(`${rec.userId}_${toDateKey(dateObj)}`, rec)
  })

  const absenceByKey = new Map()
  absenceRecords.forEach((rec) => {
    const dateObj = parseApiDate(rec.dateRaw)
    if (!rec.userId || !dateObj) return
    // Only count absences the admin has approved ("allow") as excused S/I.
    if (rec.sign !== 'allow') return
    absenceByKey.set(`${rec.userId}_${toDateKey(dateObj)}`, rec)
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return students.map((student) => {
    let sCount = 0
    let iCount = 0
    let aCount = 0

    const marks = days.map((day) => {
      const key = `${student.id}_${toDateKey(day)}`
      const dayIsFuture = day.getTime() > today.getTime()

      if (attendanceByKey.has(key)) return 'V'

      const absence = absenceByKey.get(key)
      if (absence) {
        if (absence.isSick) {
          sCount += 1
          return 'S'
        }
        iCount += 1
        return 'I'
      }

      if (dayIsFuture) return ''

      aCount += 1
      return 'A'
    })

    return { student, marks, sCount, iCount, aCount }
  })
}

/**
 * Builds the full CSV text: header (Nama/Alamat DU/DI), one or more
 * 6-row blocks (mirroring the template's print layout), and the closing
 * signature block.
 */
export function buildFilledCsv({ duName = '', duAddress = '', days, recapRows }) {
  const lines = []

  lines.push(toCsvLine(padTo17(['Nama DU/DI :', duName])))
  lines.push(toCsvLine(padTo17(['Alamat DU/DI :', duAddress])))
  lines.push(toCsvLine(BLANK_ROW()))

  const chunks = []
  for (let i = 0; i < recapRows.length; i += ROWS_PER_BLOCK) {
    chunks.push(recapRows.slice(i, i + ROWS_PER_BLOCK))
  }
  if (chunks.length === 0) chunks.push([])

  chunks.forEach((chunk) => {
    lines.push(toCsvLine(TABLE_HEADER_ROW_1()))
    lines.push(toCsvLine(TABLE_HEADER_ROW_2(days)))
    lines.push(toCsvLine(BLANK_ROW()))

    for (let row = 0; row < ROWS_PER_BLOCK; row += 1) {
      const entry = chunk[row]
      if (!entry) {
        lines.push(toCsvLine(padTo17([String(row + 1)])))
        continue
      }
      lines.push(
        toCsvLine(
          padTo17([
            String(row + 1),
            entry.student.name,
            ...entry.marks,
            String(entry.sCount),
            String(entry.iCount),
            String(entry.aCount),
          ])
        )
      )
    }
  })

  lines.push(toCsvLine(BLANK_ROW()))
  lines.push(toCsvLine(padTo17(['            Mengesahkan,'])))
  lines.push(toCsvLine(padTo17(['            Instruktur DU/DI:'])))
  lines.push(toCsvLine(padTo17(['', '', 'ttd'])))
  lines.push(toCsvLine(padTo17(['', '', '.'.repeat(55)])))
  lines.push(toCsvLine(BLANK_ROW()))

  return lines.join('\r\n')
}

export function downloadFilledCsv(csvText, filename) {
  const blob = new Blob(['\ufeff' + csvText], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

export function downloadBlob(blob, filename) {
  triggerDownload(blob, filename)
}
