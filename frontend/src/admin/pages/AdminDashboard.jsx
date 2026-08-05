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
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import * as api from '../lib/api.js'
import { unwrapList, normalizeUser, normalizeAttendance, normalizeAbsence } from '../lib/normalize.js'
import { parseApiDate, toDateKey } from '../lib/dateWindow.js'
import StatCard from '../components/StatCard.jsx'
import PageHeader from '../components/PageHeader.jsx'

const SAMPLE_LIMIT = 150
const TREND_DAYS = 14

export default function AdminDashboard() {
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)
  const [studentCount, setStudentCount] = useState(null)
  const [studentCapped, setStudentCapped] = useState(false)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [absence, setAbsence] = useState([])

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

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
        const studentList = users.filter((u) => u.type !== 'admin')
        setStudents(studentList)
        setStudentCount(studentList.length)
        setStudentCapped(studentList.length >= SAMPLE_LIMIT)

        const attendanceRows = unwrapList(attendanceJson, 'attendances')
          .map(normalizeAttendance)
          .filter(Boolean)
        setAttendance(attendanceRows)

        const absenceRows = unwrapList(absenceJson, 'absences').map(normalizeAbsence).filter(Boolean)
        setAbsence(absenceRows)
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load the dashboard summary.')
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

  const presentTodayCount = useMemo(() => {
    const todayKey = toDateKey(new Date())
    const ids = new Set()
    attendance.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (d && toDateKey(d) === todayKey && row.userId != null) ids.add(row.userId)
    })
    return ids.size
  }, [attendance])

  // Count students who submitted leave/sick today (should NOT be counted as "not checked in")
  const leaveTodayCount = useMemo(() => {
    const todayKey = toDateKey(new Date())
    const ids = new Set()
    absence.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (d && toDateKey(d) === todayKey && row.userId != null) ids.add(row.userId)
    })
    return ids.size
  }, [absence])

  const notCheckedInCount = studentCount == null ? null : Math.max(studentCount - presentTodayCount - leaveTodayCount, 0)

  // Trend data: for each day, count Present and Leave
  const trendData = useMemo(() => {
    const buckets = new Map()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      buckets.set(toDateKey(d), {
        key: toDateKey(d),
        label: d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' }),
        Present: 0,
        Leave: 0,
      })
    }

    // Count distinct students with attendance per day
    attendance.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (!d) return
      const key = toDateKey(d)
      if (buckets.has(key)) buckets.get(key).Present += 1
    })

    // Count distinct students with absence per day
    const absenceByDay = new Map()
    absence.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (!d) return
      const key = toDateKey(d)
      if (!absenceByDay.has(key)) absenceByDay.set(key, new Set())
      if (row.userId) absenceByDay.get(key).add(row.userId)
    })
    absenceByDay.forEach((ids, key) => {
      if (buckets.has(key)) buckets.get(key).Leave = ids.size
    })

    return Array.from(buckets.values())
  }, [attendance, absence])

  // Pie chart: today's status breakdown (always show, even if zero)
  const pieData = useMemo(() => {
    const todayKey = toDateKey(new Date())

    // Present today
    const presentIds = new Set()
    attendance.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (d && toDateKey(d) === todayKey && row.userId != null) presentIds.add(row.userId)
    })
    const present = presentIds.size

    // Leave today (absence submitted today)
    const leaveIds = new Set()
    absence.forEach((row) => {
      const d = parseApiDate(row.dateRaw)
      if (d && toDateKey(d) === todayKey && row.userId != null) leaveIds.add(row.userId)
    })
    const leave = leaveIds.size

    // Alpha = total students - present - leave
    const alpha = studentCount != null ? Math.max(studentCount - present - leave, 0) : 0

    return [
      { id: 'Ok', value: present, label: 'Ok', color: 'var(--color-success)' },
      { id: 'Leave', value: leave, label: 'Leave', color: 'var(--color-primary)' },
      { id: 'No Act', value: alpha, label: 'No Act', color: 'var(--color-danger)' },
    ]
  }, [attendance, absence, studentCount])

  const nivoTheme = {
    fontFamily: 'Inter, sans-serif',
    text: { fill: isDark ? '#e5e5e5' : '#1a1a1a' },
    axis: {
      ticks: { text: { fill: isDark ? '#a3a3a3' : '#666666' } },
      legend: { text: { fill: isDark ? '#a3a3a3' : '#666666' } },
    },
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={House}
        eyebrow="Summary"
        title="Dashboard"
        description="Attendance and leave/absence submissions summary for Takota students."
      />

      <div data-guide="stat-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Students"
          value={loading ? '-' : `${studentCount}${studentCapped ? '+' : ''}`}
          icon={Persons}
          tone="primary"
        />
        <StatCard
          label="Present Today"
          value={loading ? '-' : todayCount}
          icon={Clock}
          tone="success"
          hint={`out of ${attendance.length} recent records`}
        />
        <StatCard
          label="Pending Leave"
          value={loading ? '-' : pendingCount}
          icon={FileCheck}
          tone="warning"
          hint="needs review"
        />
        <StatCard
          label="Not Checked In Today"
          value={loading ? '-' : notCheckedInCount}
          icon={PersonXmark}
          tone="danger"
          hint={`out of ${studentCount}${studentCapped ? '+' : ''} registered students`}
        />
      </div>

      <div data-guide="charts" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2 shadow-none dark:border-neutral-800">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Attendance Trend - Last 14 Days</p>
            <span className="flex items-center gap-1.5 text-xs text-neutral dark:text-neutral-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="presence-pulse absolute inset-0 rounded-full bg-primary" />
                <span className="relative h-full w-full rounded-full bg-primary" />
              </span>
              Today
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveBar
              data={trendData}
              keys={['Present', 'Leave']}
              indexBy="label"
              margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
              padding={0.3}
              colors={({ id }) => {
                if (id === 'Present') return 'var(--color-success)'
                return 'var(--color-primary)'
              }}
              borderRadius={4}
              theme={nivoTheme}
              enableGridX={false}
              enableGridY={false}
              axisBottom={{
                tickSize: 0,
                tickPadding: 12,
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 12,
                format: (v) => Number.isInteger(v) ? v : '',
              }}
              enableLabel={false}
              tooltip={({ id, value, color }) => (
                <div className="rounded-lg bg-white px-3 py-2 shadow-lg dark:bg-neutral-800">
                  <span className="text-sm font-medium" style={{ color }}>{id}: {value}</span>
                </div>
              )}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'bottom',
                  direction: 'row',
                  translateY: 40,
                  itemWidth: 80,
                  itemHeight: 16,
                  symbolShape: 'circle'
                }
              ]}
            />
          </div>
        </Card>

        <Card className="p-4 shadow-none dark:border-neutral-800">
          <p className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Today's Status</p>
          <div className="h-64 w-full">
            <ResponsivePie
              data={pieData}
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.5}
              padAngle={0.6}
              cornerRadius={2}
              activeOuterRadiusOffset={8}
              colors={({ data }) => data.color}
              theme={nivoTheme}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor={isDark ? '#a3a3a3' : '#555555'}
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: 'color' }}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{ from: 'color', modifiers: [['darker', isDark ? -1.5 : 2]] }}
              tooltip={({ datum }) => (
                <div className="rounded-lg bg-white px-3 py-2 shadow-lg dark:bg-neutral-800">
                  <span className="text-sm font-medium" style={{ color: datum.color }}>{datum.label}: {datum.value}</span>
                </div>
              )}
              legends={[
                {
                  anchor: 'bottom',
                  direction: 'row',
                  translateY: 56,
                  itemWidth: 100,
                  itemHeight: 18,
                  symbolShape: 'circle'
                }
              ]}
            />
          </div>
        </Card>
      </div>

      <Card className="p-4 shadow-none dark:border-neutral-800">
        <p className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">No Action Today</p>
        <div className="flex flex-col divide-y divide-app-border/10 dark:divide-white/10">
          {(() => {
            const todayKey = toDateKey(new Date())
            const presentToday = new Set()
            attendance.forEach((row) => {
              const d = parseApiDate(row.dateRaw)
              if (d && toDateKey(d) === todayKey && row.userId != null) presentToday.add(row.userId)
            })
            const leaveToday = new Set()
            absence.forEach((row) => {
              const d = parseApiDate(row.dateRaw)
              if (d && toDateKey(d) === todayKey && row.userId != null) leaveToday.add(row.userId)
            })
            const noAction = students.filter((s) => !presentToday.has(s.id) && !leaveToday.has(s.id))
            if (noAction.length === 0) {
              return <p className="py-4 text-center text-sm text-neutral dark:text-neutral-400">All students have checked in or submitted leave today</p>
            }
            return noAction.map((student) => (
              <div key={student.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-xs font-bold text-danger">
                  {(student.nickname || student.username || '?')[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{student.nickname || '-'}</p>
                  <p className="truncate text-xs text-neutral dark:text-neutral-400">{student.username}</p>
                </div>
              </div>
            ))
          })()}
        </div>
      </Card>

      <Card data-guide="recent-activity" className="p-4 shadow-none dark:border-neutral-800">
        <p className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Recent Activity</p>
        <div className="flex flex-col divide-y divide-app-border/10 dark:divide-white/10">
          {(() => {
            // Combine attendance and absence into a single activity list
            const activities = []

            // Add attendance entries (green)
            attendance.slice(0, 10).forEach((row) => {
              activities.push({
                id: row.id,
                name: row.name,
                username: row.username,
                dateRaw: row.dateRaw,
                type: 'attendance',
              })
            })

            // Add absence entries (yellow)
            absence.slice(0, 10).forEach((row) => {
              activities.push({
                id: row.id,
                name: row.name,
                username: row.username,
                dateRaw: row.dateRaw,
                type: 'absence',
                isSick: row.isSick,
              })
            })

            // Sort by date descending
            activities.sort((a, b) => {
              const dateA = parseApiDate(a.dateRaw)
              const dateB = parseApiDate(b.dateRaw)
              if (!dateA || !dateB) return 0
              return dateB - dateA
            })

            // Take only the 6 most recent
            const recentActivities = activities.slice(0, 6)

            if (recentActivities.length === 0) {
              return <p className="py-4 text-center text-sm text-neutral dark:text-neutral-400">No activity yet</p>
            }

            return recentActivities.map((activity) => {
              const isAttendance = activity.type === 'attendance'
              const bgColor = isAttendance ? 'bg-success/10' : 'bg-warning/10'
              const textColor = isAttendance ? 'text-success' : 'text-warning'
              const label = isAttendance ? 'Present' : (activity.isSick ? 'Sick' : 'Leave')

              return (
                <div key={activity.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgColor} text-xs font-bold ${textColor}`}>
                      {(activity.name || activity.username || '?')[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{activity.name || '-'}</p>
                      <p className="truncate text-xs text-neutral dark:text-neutral-400">
                        {activity.username} - {label}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-neutral dark:text-neutral-400">
                    {parseApiDate(activity.dateRaw)?.toLocaleString('en-US', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) || '-'}
                  </p>
                </div>
              )
            })
          })()}
        </div>
      </Card>
    </div>
  )
}