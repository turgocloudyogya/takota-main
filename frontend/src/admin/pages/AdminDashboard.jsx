import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@heroui/react'
import {
  Persons,
  Clock,
  FileCheck,
  PersonXmark,
  House,
} from '@gravity-ui/icons'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import * as api from '../lib/api.js'
import { unwrapList, normalizeUser, normalizeAttendance, normalizeAbsence } from '../lib/normalize.js'
import { parseApiDate, toDateKey } from '../lib/dateWindow.js'
import StatCard from '../components/StatCard.jsx'
import PageHeader from '../components/PageHeader.jsx'

const SAMPLE_LIMIT = 150
const TREND_DAYS = 14

const PIE_COLORS = {
  Sakit: 'var(--color-warning)',
  Izin: 'var(--color-primary)',
  Menunggu: 'var(--color-neutral)',
  Ditolak: 'var(--color-danger)',
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [studentCount, setStudentCount] = useState(null)
  const [studentCapped, setStudentCapped] = useState(false)
  const [attendance, setAttendance] = useState([])
  const [absence, setAbsence] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [usersJson, attendanceJson, absenceJson] = await Promise.all([
          api.listUsers({ limit: SAMPLE_LIMIT }),
          api.listAttendance({ limit: SAMPLE_LIMIT }),
          api.listAbsence({ limit: SAMPLE_LIMIT }),
        ])
        if (cancelled) return

        const users = unwrapList(usersJson, 'users').map(normalizeUser).filter(Boolean)
        const students = users.filter((u) => u.type !== 'admin')
        setStudentCount(students.length)
        setStudentCapped(students.length >= SAMPLE_LIMIT)

        const attendanceRows = unwrapList(attendanceJson, 'attendances')
          .map(normalizeAttendance)
          .filter(Boolean)
        setAttendance(attendanceRows)

        const absenceRows = unwrapList(absenceJson, 'absences').map(normalizeAbsence).filter(Boolean)
        setAbsence(absenceRows)
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Gagal memuat ringkasan dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const todayCount = useMemo(() => {
    const todayKey = toDateKey(new Date())
    return attendance.filter((row) => {
      const d = parseApiDate(row.dateRaw)
      return d && toDateKey(d) === todayKey
    }).length
  }, [attendance])

  const pendingCount = useMemo(() => absence.filter((row) => row.sign === 'pending').length, [absence])

  // Distinct students with at least one attendance row today (not just a
  // row count, so a student who checks in and out twice isn't counted
  // twice). Used to figure out who's still missing for the day.
  const presentTodayCount = useMemo(() => {
    const todayKey = toDateKey(new Date())
    const ids = new Set()
    attendance.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (d && toDateKey(d) === todayKey && row.userId != null) ids.add(row.userId)
    })
    return ids.size
  }, [attendance])

  const notCheckedInCount = studentCount == null ? null : Math.max(studentCount - presentTodayCount, 0)

  const trendData = useMemo(() => {
    const buckets = new Map()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      buckets.set(toDateKey(d), {
        key: toDateKey(d),
        label: d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }),
        Hadir: 0,
      })
    }

    attendance.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (!d) return
      const key = toDateKey(d)
      if (buckets.has(key)) buckets.get(key).Hadir += 1
    })

    return Array.from(buckets.values())
  }, [attendance])

  const pieData = useMemo(() => {
    let sakit = 0
    let izin = 0
    let pending = 0
    let ditolak = 0

    absence.forEach((row) => {
      if (row.sign === 'pending') pending += 1
      else if (row.sign === 'allow') {
        if (row.isSick) sakit += 1
        else izin += 1
      } else if (row.sign === 'deny') ditolak += 1
    })

    return [
      { name: 'Sakit', value: sakit },
      { name: 'Izin', value: izin },
      { name: 'Menunggu', value: pending },
      { name: 'Ditolak', value: ditolak },
    ].filter((d) => d.value > 0)
  }, [absence])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={House}
        eyebrow="Ringkasan"
        title="Dashboard"
        description="Ringkasan presensi dan pengajuan izin siswa Takota."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Siswa"
          value={loading ? '—' : `${studentCount}${studentCapped ? '+' : ''}`}
          icon={Persons}
          tone="primary"
        />
        <StatCard
          label="Hadir Hari Ini"
          value={loading ? '—' : todayCount}
          icon={Clock}
          tone="success"
          hint={`dari ${attendance.length} data terbaru`}
        />
        <StatCard
          label="Izin Menunggu"
          value={loading ? '—' : pendingCount}
          icon={FileCheck}
          tone="warning"
          hint="perlu ditinjau"
        />
        <StatCard
          label="Belum Presensi Hari Ini"
          value={loading ? '—' : notCheckedInCount}
          icon={PersonXmark}
          tone="danger"
          hint={`dari ${studentCount}${studentCapped ? '+' : ''} siswa terdaftar`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Tren Kehadiran 14 Hari Terakhir</p>
            <span className="flex items-center gap-1.5 text-xs text-neutral">
              <span className="relative flex h-1.5 w-1.5">
                <span className="presence-pulse absolute inset-0 rounded-full bg-primary" />
                <span className="relative h-full w-full rounded-full bg-primary" />
              </span>
              Hari ini
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-app-border)" strokeOpacity={0.25} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <Tooltip />
                <Bar dataKey="Hadir" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-4 text-sm font-semibold text-neutral-900">Distribusi Pengajuan</p>
          {pieData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-neutral">
              Belum ada data pengajuan
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-neutral-900">Aktivitas Presensi Terbaru</p>
        <div className="flex flex-col divide-y divide-app-border/10">
          {attendance.slice(0, 6).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-xs font-bold text-success">
                  {(row.name || row.username || '?')[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{row.name || '—'}</p>
                  <p className="truncate text-xs text-neutral">{row.username}</p>
                </div>
              </div>
              <p className="shrink-0 text-xs text-neutral">
                {parseApiDate(row.dateRaw)?.toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }) || '—'}
              </p>
            </div>
          ))}
          {!loading && attendance.length === 0 && (
            <p className="py-4 text-center text-sm text-neutral">Belum ada aktivitas presensi</p>
          )}
        </div>
      </Card>
    </div>
  )
}