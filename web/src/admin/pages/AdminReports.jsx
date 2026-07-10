import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { FileArrowDown, ArrowDownToLine } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeUser } from '../lib/normalize.js'
import { getTwoWeekWindow, formatShortDate, toDateKey } from '../lib/dateWindow.js'
import { downloadBlankTemplate, downloadBlob } from '../lib/csvTemplate.js'
import { TextInput } from '../components/FormField.jsx'
import PageHeader from '../components/PageHeader.jsx'

const STUDENT_FETCH_LIMIT = 100
const STUDENT_FETCH_MAX_PAGES = 10

function todayIsoDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
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

  const [anchorDate, setAnchorDate] = useState(todayIsoDate())
  const [duName, setDuName] = useState('')
  const [duAddress, setDuAddress] = useState('')
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

  const days = useMemo(() => getTwoWeekWindow(new Date(`${anchorDate}T00:00:00`)), [anchorDate])

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

  async function handleBuildPDF() {
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal satu siswa untuk dibuatkan rekap.')
      return
    }
    setBuilding(true)
    try {
      const start = days[0]
      const end = days[days.length - 1]
      const startDate = toDateKey(start)
      const endDate = toDateKey(end)

      const { blob, filename } = await api.exportAttendancePDF({
        startDate,
        endDate,
        duName,
        duAddress,
        studentIds: [...selectedIds],
      })
      downloadBlob(blob, filename)
      toast.success('Rekap presensi PDF berhasil dibuat dan diunduh.')
    } catch (err) {
      toast.error(err.message || 'Gagal membuat rekap presensi PDF.')
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
        description="Unduh formulir Daftar Hadir Peserta Didik — kosong untuk diisi manual, atau terisi otomatis dari data presensi aplikasi."
      />

      {/* Blank template */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon data={FileArrowDown} size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Unduh Formulir Kosong</p>
            <p className="text-sm text-neutral">
              Salinan asli format Daftar Hadir Peserta Didik, siap cetak dan diisi manual kapan pun.
            </p>
          </div>
        </div>
        <Button variant="outline" onPress={() => downloadBlankTemplate()}>
          <Icon data={ArrowDownToLine} size={15} />
          Unduh Template
        </Button>
      </Card>

      {/* PDF recap builder */}
      <Card className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Buat Rekap Presensi (2 Minggu) — PDF</p>
          <p className="text-sm text-neutral">
            Nama, tanggal, status kehadiran (V/S/I/A), dan total sakit/izin/alpha diisi otomatis dari data
            presensi &amp; izin siswa. Dihasilkan sebagai file PDF siap cetak.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            type="date"
            label="Periode (pilih tanggal mana saja dalam pekan pertama)"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
          />
          <div className="flex flex-col justify-end gap-1 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm">
            <span className="text-xs font-medium text-neutral-600">Rentang dua minggu</span>
            <span className="font-medium text-neutral-900">
              {formatShortDate(days[0])} – {formatShortDate(days[days.length - 1])}
            </span>
          </div>
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

        <Button variant="primary" onPress={handleBuildPDF} isDisabled={building} className="self-start">
          <Icon data={FileArrowDown} size={15} />
          {building ? 'Membuat rekap…' : 'Buat & Unduh PDF'}
        </Button>
      </Card>
    </div>
  )
}
