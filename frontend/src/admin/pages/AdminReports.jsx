import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { FileArrowDown } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeUser } from '../lib/normalize.js'
import { formatShortDate, countWorkingDays, estimatePageCount } from '../lib/dateWindow.js'
import { downloadBlob } from '../lib/download.js'
import { downloadAttendanceReportPdf } from '../lib/attendanceReportHtml.js'
import { TextInput } from '../components/FormField.jsx'
import PageHeader from '../components/PageHeader.jsx'

const STUDENT_FETCH_LIMIT = 100
const STUDENT_FETCH_MAX_PAGES = 10

function toIsoDate(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function todayIsoDate() {
  return toIsoDate(new Date())
}

function startOfMonthIsoDate() {
  const d = new Date()
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

async function fetchAllStudents() {
  let cursor = ''
  const all = []
  for (let page = 0; page < STUDENT_FETCH_MAX_PAGES; page += 1) {
    const json = await api.listUsers({ limit: STUDENT_FETCH_LIMIT, lastId: cursor })
    const rows = unwrapList(json, 'users').map(normalizeUser).filter(Boolean)
    all.push(...rows)
    if (rows.length < STUDENT_FETCH_LIMIT) break
    cursor = rows[rows.length - 1].id
  }
  return all.filter((u) => u.type !== 'admin')
}

export default function AdminReports() {
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [studentFilter, setStudentFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const [startDate, setStartDate] = useState(startOfMonthIsoDate())
  const [endDate, setEndDate] = useState(todayIsoDate())
  const [duName, setDuName] = useState('')
  const [duAddress, setDuAddress] = useState('')
  const [format, setFormat] = useState('pdf') // 'pdf' | 'xlsx'
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingStudents(true)
      try {
        const all = await fetchAllStudents()
        if (!cancelled) {
          setStudents(all)
          setSelectedIds(new Set(all.map((s) => s.id)))
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Gagal memuat daftar siswa.')
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const rangeIsValid = Boolean(startDate) && Boolean(endDate) && startDate <= endDate
  const workingDays = useMemo(
    () => (rangeIsValid ? countWorkingDays(startDate, endDate) : 0),
    [startDate, endDate, rangeIsValid]
  )
  const pageEstimate = useMemo(() => estimatePageCount(workingDays), [workingDays])

  const filteredStudents = useMemo(() => {
    const term = studentFilter.trim().toLowerCase()
    if (!term) return students
    return students.filter(
      (s) =>
        s.nickname?.toLowerCase().includes(term) ||
        s.username?.toLowerCase().includes(term) ||
        s.callname?.toLowerCase().includes(term)
    )
  }, [students, studentFilter])

  function toggleStudent(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const allSelected = filteredStudents.every((s) => prev.has(s.id))
      const next = new Set(prev)
      filteredStudents.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)))
      return next
    })
  }

  async function handleBuildRecap() {
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal satu siswa untuk dibuatkan rekap.')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Tentukan tanggal mulai dan tanggal akhir rekap.')
      return
    }
    if (startDate > endDate) {
      toast.error('Tanggal akhir tidak boleh sebelum tanggal mulai.')
      return
    }

    setBuilding(true)
    try {
      const payload = { startDate, endDate, duName, duAddress, studentIds: [...selectedIds] }
      const filename = `Rekap-Presensi_${startDate}_${endDate}.${format}`

      if (format === 'xlsx') {
        const { blob } = await api.exportAttendanceXLSX(payload)
        downloadBlob(blob, filename)
      } else {
        const doc = await api.fetchAttendanceReportData(payload)
        await downloadAttendanceReportPdf(doc, filename)
      }

      toast.success(`Rekap presensi ${format.toUpperCase()} berhasil dibuat dan diunduh.`)
    } catch (err) {
      toast.error(err.message || `Gagal membuat rekap presensi ${format.toUpperCase()}.`)
    } finally {
      setBuilding(false)
    }
  }

  const allFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.id))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileArrowDown}
        eyebrow="Laporan"
        title="Rekap & Unduh"
        description="Buat rekap Daftar Hadir Peserta Didik dari data presensi & izin aplikasi, untuk rentang tanggal berapa pun."
      />

      {/* Recap builder */}
      <Card className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Buat Rekap Presensi</p>
          <p className="text-sm text-neutral">
            Nama, tanggal, status kehadiran (V/S/I/A), dan total sakit/izin/alpa per siswa diisi otomatis dari
            data presensi &amp; izin. Rentang tanggal dipilih bebas — jika lebih dari 2 minggu hari kerja,
            hasil otomatis terbagi ke beberapa halaman dengan format tabel yang sama persis (utuh 2 tabel per
            halaman), termasuk kalau halaman terakhir cuma berisi data satu hari.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            type="date"
            label="Tanggal mulai rekap"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <TextInput
            type="date"
            label="Tanggal akhir rekap"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <TextInput
            label="Nama DU/DI (opsional)"
            placeholder="cth. PT Sinar Abadi"
            value={duName}
            onChange={(e) => setDuName(e.target.value)}
          />
          <TextInput
            label="Alamat DU/DI (opsional)"
            placeholder="cth. Jl. Industri No. 12"
            value={duAddress}
            onChange={(e) => setDuAddress(e.target.value)}
          />
        </div>

        <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm">
          {rangeIsValid ? (
            <span className="text-neutral-700">
              <span className="font-medium text-neutral-900">
                {formatShortDate(new Date(`${startDate}T00:00:00`))} –{' '}
                {formatShortDate(new Date(`${endDate}T00:00:00`))}
              </span>{' '}
              · {workingDays} hari kerja (Senin–Sabtu) · diperkirakan{' '}
              <span className="font-medium text-neutral-900">{pageEstimate} halaman</span>
            </span>
          ) : (
            <span className="text-danger">Tanggal akhir tidak boleh sebelum tanggal mulai.</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600">Format unduhan</span>
          <div className="flex gap-2">
            <Button
              variant={format === 'pdf' ? 'primary' : 'outline'}
              onPress={() => setFormat('pdf')}
              className="min-w-[96px]"
            >
              PDF
            </Button>
            <Button
              variant={format === 'xlsx' ? 'primary' : 'outline'}
              onPress={() => setFormat('xlsx')}
              className="min-w-[96px]"
            >
              XLSX
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-app-border/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <input
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="Cari siswa…"
              className="w-full max-w-[220px] rounded-lg bg-neutral-100 px-3 py-1.5 text-sm outline-none placeholder:text-neutral"
            />
            <button
              type="button"
              onClick={toggleAllFiltered}
              className="shrink-0 text-xs font-medium text-primary"
            >
              {allFilteredSelected ? 'Batal pilih semua' : 'Pilih semua'}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loadingStudents ? (
              <p className="py-6 text-center text-sm text-neutral">Memuat siswa…</p>
            ) : filteredStudents.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral">Tidak ada siswa ditemukan</p>
            ) : (
              <ul className="flex flex-col divide-y divide-app-border/10">
                {filteredStudents.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-2.5 px-1 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-neutral-900">{s.nickname}</span>
                      <span className="text-xs text-neutral">{s.username}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-neutral">{selectedIds.size} siswa dipilih</p>
        </div>

        <Button
          variant="primary"
          onPress={handleBuildRecap}
          isDisabled={building || !rangeIsValid}
          className="self-start"
        >
          <Icon data={FileArrowDown} size={15} />
          {building ? 'Membuat rekap…' : `Buat & Unduh ${format.toUpperCase()}`}
        </Button>
      </Card>
    </div>
  )
}