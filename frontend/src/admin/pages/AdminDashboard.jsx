import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Persons, Check, FileCheck, TriangleExclamation, ArrowRightFromLine } from '@gravity-ui/icons'
import { ResponsiveLine } from '@nivo/line'
import { Label, ListBox, Select } from '@heroui/react'
import ActivityHeatmap from '../components/ActivityHeatmap.jsx'
import { listUsers } from '../lib/api.js'
import { unwrapList, normalizeUser } from '../lib/normalize.js'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [trend, setTrend] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [activityUser, setActivityUser] = useState('all')

  useEffect(() => {
    loadDashboardData()
    loadUserOptions()
  }, [])

  useEffect(() => {
    loadActivity(activityUser)
  }, [activityUser])

  async function loadUserOptions() {
    try {
      const json = await listUsers({ limit: 100 })
      const list = unwrapList(json, 'users').map(normalizeUser).filter(Boolean)
      setUsers(list.filter((u) => u.type === 'user'))
    } catch (err) {
      console.error('Failed to load user options:', err)
    }
  }

  async function loadActivity(userId) {
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
  }

  async function loadDashboardData() {
    try {
      setLoading(true)

      // Load stats
      const statsResponse = await fetch('/api/admin/dashboard/stats', {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })

      if (!statsResponse.ok) throw new Error('Failed to load stats')
      const statsData = await statsResponse.json()
      setStats(statsData.data)

      // Load trend
      const trendResponse = await fetch('/api/admin/dashboard/trend', {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })

      if (!trendResponse.ok) throw new Error('Failed to load trend')
      const trendData = await trendResponse.json()
      setTrend(trendData.data)
    } catch (err) {
      toast.error('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-lg bg-red-50 p-4 dark:bg-red-500/10">
        <p className="text-sm text-red-900 dark:text-red-200">Failed to load dashboard data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Overview of attendance and absence records
        </p>
      </div>

      {/* Stats Grid */}
      <div data-guide="stat-cards" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Users */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Total Users</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.total_users}
              </p>
            </div>
            <Icon data={Persons} size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Today's Check-ins</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.attendance_today}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {stats.attendance_rate ? stats.attendance_rate.toFixed(1) : 0}% attendance rate
              </p>
            </div>
            <Icon data={Check} size={24} className="text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Today's Absence */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Today's Absence</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.absence_today}
              </p>
            </div>
            <Icon data={FileCheck} size={24} className="text-orange-600 dark:text-orange-400" />
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Pending Approvals</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.pending_approvals}
              </p>
            </div>
            <Icon data={TriangleExclamation} size={24} className="text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        {/* Total Attendance */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Total Check-ins</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.total_attendance}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Avg: {stats.average_attendance ? stats.average_attendance.toFixed(1) : 0} per user
              </p>
            </div>
            <Icon data={ArrowRightFromLine} size={24} className="text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        {/* Most Frequent Time */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Peak Check-in Time</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.most_frequent_time}
              </p>
            </div>
            <Icon data={ArrowRightFromLine} size={24} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Weekly Average Check-ins */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Daily Average Check-ins (7d)</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.weekly_avg_checkins ? stats.weekly_avg_checkins.toFixed(1) : 0}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Average check-ins per day, last 7 days
              </p>
            </div>
            <Icon data={Check} size={24} className="text-teal-600 dark:text-teal-400" />
          </div>
        </div>

        {/* Weekly Average Absences */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Daily Average Absences (7d)</p>
              <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.weekly_avg_absences ? stats.weekly_avg_absences.toFixed(1) : 0}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Average absence requests per day, last 7 days
              </p>
            </div>
            <Icon data={FileCheck} size={24} className="text-rose-600 dark:text-rose-400" />
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Overall Statistics</p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-neutral-600 dark:text-neutral-400">Total Absence Requests:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{stats.total_absence}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-neutral-600 dark:text-neutral-400">Total Alpha:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{stats.total_alpha}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart Data */}
      {trend && trend.length > 0 && (
        <div data-guide="charts" className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">7-Day Trend</h3>
          <div className="mt-4 h-72">
            <ResponsiveLine
              data={[
                {
                  id: 'Check-ins',
                  data: trend.map((day) => ({ x: day.date, y: Number(day.attendance) || 0 })),
                },
                {
                  id: 'Absences',
                  data: trend.map((day) => ({ x: day.date, y: Number(day.absence) || 0 })),
                },
              ]}
              margin={{ top: 16, right: 24, bottom: 48, left: 44 }}
              xScale={{ type: 'point' }}
              yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
              curve="monotoneX"
              axisBottom={{
                tickSize: 0,
                tickPadding: 10,
                tickRotation: -25,
                legend: 'Date',
                legendOffset: 40,
                legendPosition: 'middle',
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                legend: 'Records',
                legendOffset: -36,
                legendPosition: 'middle',
              }}
              colors={['#16a34a', '#f97316']}
              pointSize={8}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              pointLabelYOffset={-12}
              useMesh
              enableSlices="x"
              legends={[
                {
                  anchor: 'top-left',
                  direction: 'row',
                  translateY: -16,
                  itemWidth: 110,
                  itemHeight: 20,
                  symbolSize: 12,
                  symbolShape: 'circle',
                },
              ]}
              theme={{
                axis: {
                  ticks: { text: { fill: '#888888', fontSize: 11 } },
                  legend: { text: { fill: '#888888', fontSize: 12 } },
                },
                grid: { line: { strokeDasharray: '3 3', stroke: '#e5e5e5' } },
                legends: { text: { fill: '#888888', fontSize: 12 } },
                tooltip: {
                  container: {
                    fontSize: 12,
                    background: '#111827',
                    color: '#f9fafb',
                    borderRadius: 8,
                  },
                },
              }}
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-2 py-2 text-left text-neutral-600 dark:text-neutral-400">Date</th>
                  <th className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">Check-ins</th>
                  <th className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">Absences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {trend.map((day, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2 text-neutral-900 dark:text-neutral-100">{day.date}</td>
                    <td className="px-2 py-2 text-right text-green-600 dark:text-green-400">{day.attendance}</td>
                    <td className="px-2 py-2 text-right text-orange-600 dark:text-orange-400">{day.absence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Heatmap */}
      <div data-guide="activity-heatmap" className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Activity</h3>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              Daily attendance activity, last 5 months
            </p>
          </div>
          <div className="w-56">
            <Select
              selectedKey={activityUser}
              onSelectionChange={(key) => setActivityUser(String(key))}
              fullWidth
            >
              <Label>User</Label>
              <Select.Trigger className="bg-neutral-100 dark:bg-neutral-900 shadow-none">
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
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading activity…</p>
          ) : (
            <ActivityHeatmap days={activity} />
          )}
        </div>
      </div>
    </div>
  )
}
