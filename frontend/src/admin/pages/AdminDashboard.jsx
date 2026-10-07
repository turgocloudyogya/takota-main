import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Persons, Check, FileCheck, TriangleExclamation, Clock } from '@gravity-ui/icons'
import { ResponsiveBar } from '@nivo/bar'
import { Label, ListBox, Select } from '@heroui/react'
import { useTheme } from '../../lib/useTheme.js'
import ActivityHeatmap from '../components/ActivityHeatmap.jsx'
import { MetricSkeleton, PanelSkeleton } from '../../components/Skeletons.jsx'
import { listUsers } from '../lib/api.js'
import { unwrapList, normalizeUser } from '../lib/normalize.js'

function Metric({ label, value, sub, icon }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>
          )}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <Icon data={icon} size={18} />
        </span>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [trend, setTrend] = useState(null)
  const [topAbsent, setTopAbsent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activity, setActivity] = useState(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [activityUser, setActivityUser] = useState('all')

  const loadUserOptions = useCallback(async () => {
    try {
      const json = await listUsers({ limit: 100 })
      const list = unwrapList(json, 'users').map(normalizeUser).filter(Boolean)
      setUsers(list.filter((u) => u.type === 'user'))
    } catch (err) {
      console.error('Failed to load user options:', err)
    }
  }, [])

  const loadActivity = useCallback(async (userId) => {
    try {
      setActivityLoading(true)
      const params = new URLSearchParams({ days: '150' })
      if (userId && userId !== 'all') params.set('user_id', userId)
      const response = await fetch(`/api/admin/dashboard/activity?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })
      if (!response.ok) throw new Error('Failed to load activity')
      const json = await response.json()
      setActivity(json.data || [])
    } catch (err) {
      console.error('Failed to load activity:', err)
    } finally {
      setActivityLoading(false)
    }
  }, [])

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)

      const statsResponse = await fetch('/api/admin/dashboard/stats', {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })

      if (!statsResponse.ok) throw new Error('Failed to load stats')
      const statsData = await statsResponse.json()
      setStats(statsData.data)

      const trendResponse = await fetch('/api/admin/dashboard/trend', {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })

      if (!trendResponse.ok) throw new Error('Failed to load trend')
      const trendData = await trendResponse.json()
      setTrend(trendData.data)

      const topResponse = await fetch('/api/admin/dashboard/top-absent', {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })

      if (!topResponse.ok) throw new Error('Failed to load top absent users')
      const topData = await topResponse.json()
      setTopAbsent(topData.data || [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load dashboard data')
      toast.error('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      await loadDashboardData()
      await loadUserOptions()
    }
    init()
  }, [loadDashboardData, loadUserOptions])

  useEffect(() => {
    async function init() {
      await loadActivity(activityUser)
    }
    init()
  }, [activityUser, loadActivity])

  // Small screens get fewer bars so they stay readable: 30 days on
  // desktop, the last 15 on mobile.
  const [isDesktopChart, setIsDesktopChart] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 640px)')
    if (!mq) return
    const onChange = (e) => setIsDesktopChart(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Nivo draws on canvas/SVG outside Tailwind's dark: variant, so its text
  // and tooltip colors follow the app theme explicitly.
  const { theme } = useTheme()

  if (loading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            What needs attention today, then the numbers behind it
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricSkeleton label="Today's check-ins" />
          <MetricSkeleton label="On leave today" />
          <MetricSkeleton label="Peak check-in time" />
          <MetricSkeleton label="Registered users" />
        </div>
        <PanelSkeleton className="h-64" />
        <PanelSkeleton className="h-40" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-xl bg-neutral-50 p-6 text-center dark:bg-neutral-900">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Dashboard unavailable
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          {loadError || 'The server did not return statistics.'} Check the connection and try again.
        </p>
        <button
          type="button"
          onClick={loadDashboardData}
          className="mt-4 cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          Retry
        </button>
      </div>
    )
  }

  const attendanceRate = stats.attendance_rate ? `${stats.attendance_rate.toFixed(1)}% of users reported today` : 'No reports yet today'
  const avgAttendance = stats.average_attendance ? `${stats.average_attendance.toFixed(1)} check-ins per user overall` : null

  // Only days with at least one check-in or one leave get a bar.
  const activeDays = (trend || []).filter(
    (day) => (Number(day.attendance) || 0) >= 1 || (Number(day.absence) || 0) >= 1,
  )
  const visibleDays = isDesktopChart ? activeDays : activeDays.slice(-15)

  const chartTheme = {
    axis: {
      ticks: { text: { fill: theme === 'dark' ? '#e5e5e5' : '#333333', fontSize: 11 } },
    },
    legends: {
      text: { fill: theme === 'dark' ? '#e5e5e5' : '#333333', fontSize: 12 },
    },
    tooltip: {
      container: {
        fontSize: 12,
        background: theme === 'dark' ? '#171717' : '#ffffff',
        color: theme === 'dark' ? '#f5f5f5' : '#171717',
        borderRadius: 8,
      },
    },
  }

  function absenceRequestText() {
    const names = Array.isArray(stats.pending_requesters) ? stats.pending_requesters : []
    const total = stats.pending_approvals || 0
    if (total <= 0) return null
    if (names.length === 0) {
      return `${total} absence request${total === 1 ? '' : 's'} awaiting review`
    }
    if (total === 1) return `${names[0]} has requested absence`
    if (total === 2 && names.length >= 2) return `${names[0]} and ${names[1]} have requested absence`
    const others = total - 2
    return `${names[0]}, ${names[1]} and ${others} other${others === 1 ? '' : 's'} have requested absence`
  }

  const requestText = absenceRequestText()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          What needs attention today, then the numbers behind it
        </p>
      </div>

      {/* Primary: pending Leave & Sick requests. Hidden when there is nothing to review. */}
      {requestText && (
      <section data-guide="review-panel" aria-label="Absence requests awaiting review" className="rounded-xl bg-amber-50 p-4 sm:p-5 dark:bg-amber-500/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
              <Icon data={TriangleExclamation} size={20} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {requestText}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {stats.attendance_today} checked in today · {stats.absence_today} on leave today · {stats.total_alpha} unreported
              </p>
            </div>
          </div>
          <Link
            to="/admin/absence"
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 active:scale-[0.98] dark:border-neutral-600 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
          >
            Review in Leave & Sick
          </Link>
        </div>
      </section>
      )}

      {/* Secondary: today at a glance */}
      <section data-guide="stat-cards" aria-label="Today at a glance" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Today's check-ins"
          value={stats.attendance_today}
          sub={attendanceRate}
          icon={Check}
        />
        <Metric
          label="On leave today"
          value={stats.absence_today}
          sub="Approved and pending covering today"
          icon={FileCheck}
        />
        <Metric
          label="Peak check-in time"
          value={stats.most_frequent_time || '—'}
          sub="Most frequent submission hour"
          icon={Clock}
        />
        <Metric
          label="Registered users"
          value={stats.total_users}
          sub={avgAttendance}
          icon={Persons}
        />
      </section>

      {/* Tertiary: totals */}
      <section aria-label="Totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Total check-ins" value={stats.total_attendance} icon={Check} />
        <Metric label="Total absence requests" value={stats.total_absence} icon={FileCheck} />
        <Metric
          label="Daily average, last 7 days"
          value={stats.weekly_avg_checkins ? stats.weekly_avg_checkins.toFixed(1) : '0'}
          sub={`${stats.weekly_avg_absences ? stats.weekly_avg_absences.toFixed(1) : '0'} absences per day in the same period`}
          icon={Clock}
        />
      </section>

      {/* Bars answer one question: on which active days did people report? */}
      {visibleDays.length > 0 ? (
        <section data-guide="charts" aria-label="Check-ins and absences on active days" className="rounded-xl bg-neutral-50 p-4 sm:p-5 dark:bg-neutral-900">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Check-ins vs absences on active days ({visibleDays.length} days)</h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {(() => {
              const checkins = visibleDays.reduce((sum, day) => sum + (Number(day.attendance) || 0), 0)
              const absences = visibleDays.reduce((sum, day) => sum + (Number(day.absence) || 0), 0)
              const days = visibleDays.length || 1
              return `${checkins} check-ins total · ${absences} absences total · avg ${(checkins / days).toFixed(1)} check-ins per active day`
            })()}
          </p>
          <div className="bar-rise mt-4 h-64 sm:h-72">
            <ResponsiveBar
              animate={false}
              data={visibleDays.map((day) => ({
                date: day.date,
                attendance: Number(day.attendance) || 0,
                absence: Number(day.absence) || 0,
              }))}
              keys={['absence', 'attendance']}
              indexBy="date"
              colors={['#8e2bd9', '#3d6ce3']}
              labelSkipWidth={12}
              labelSkipHeight={12}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'bottom-right',
                  direction: 'column',
                  translateX: 120,
                  itemsSpacing: 3,
                  itemWidth: 100,
                  itemHeight: 16,
                },
              ]}
              axisBottom={{ tickValues: [] }}
              axisLeft={null}
              margin={{ top: 16, right: 130, bottom: 0, left: 0 }}
              enableGridY={false}
              theme={chartTheme}
            />
          </div>
        </section>
      ) : (
        <section aria-label="Check-ins and absences on active days" className="rounded-xl bg-neutral-50 p-6 text-center dark:bg-neutral-900">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">No active days yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
            Bars appear here once at least one check-in or leave is recorded on a day.
          </p>
        </section>
      )}

      {/* Most absent users: horizontal bars, usernames on the left. */}
      {topAbsent && topAbsent.length > 0 ? (
        <section data-guide="top-absent" aria-label="Users with the most absences" className="rounded-xl bg-neutral-50 p-4 sm:p-5 dark:bg-neutral-900">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Most absent users, last 30 days</h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Leave-days per user — a multi-day leave counts every covered day
          </p>
          <div className="bar-rise mt-4 h-56 sm:h-64">
            <ResponsiveBar
              animate={false}
              layout="horizontal"
              data={topAbsent.map((u) => ({
                username: u.nickname || u.username,
                absence: Number(u.leave_days) || 0,
              }))}
              keys={['absence']}
              indexBy="username"
              colors={['#8e2bd9']}
              labelSkipWidth={12}
              labelSkipHeight={12}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'bottom-right',
                  direction: 'column',
                  translateX: 120,
                  itemsSpacing: 3,
                  itemWidth: 100,
                  itemHeight: 16,
                },
              ]}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickValues: [] }}
              margin={{ top: 16, right: 130, bottom: 0, left: 0 }}
              enableGridX={false}
              theme={chartTheme}
            />
          </div>
        </section>
      ) : (
        <section aria-label="Users with the most absences" className="rounded-xl bg-neutral-50 p-6 text-center dark:bg-neutral-900">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">No absences in the last 30 days</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
            This panel lists up to 4 users once leave requests exist.
          </p>
        </section>
      )}

      {/* Activity Heatmap */}
      <section data-guide="activity-heatmap" aria-label="Activity" className="rounded-xl bg-neutral-50 p-4 sm:p-5 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Activity</h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Daily attendance activity, last 5 months
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Select
              selectedKey={activityUser}
              onSelectionChange={(key) => setActivityUser(String(key))}
              fullWidth
            >
              <Label>User</Label>
              <Select.Trigger className="bg-neutral-100 shadow-none dark:bg-neutral-900">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item key="all" id="all" textValue="All Users">
                    <Label>All Users</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {users.map((u) => (
                    <ListBox.Item key={u.id} id={u.id} textValue={u.nickname || u.username}>
                      <Label>{u.nickname || u.username}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          {activityLoading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading activity…</p>
          ) : (
            <ActivityHeatmap days={activity} />
          )}
        </div>
      </section>
    </div>
  )
}
