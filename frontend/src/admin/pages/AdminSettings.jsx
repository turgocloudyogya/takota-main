import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Clock, Check, Shield } from '@gravity-ui/icons'
import { Checkbox, Label, TimeField } from '@heroui/react'
import { parseTime } from '@internationalized/date'
import SecuritySettings from '../../components/SecuritySettings.jsx'

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

// Convert "HH:MM:SS" to "HH:MM" for the time value state
function timeToInputFormat(timeStr) {
  if (!timeStr) return '00:00'
  return timeStr.split(':').slice(0, 2).join(':')
}

// Convert "HH:MM[:SS]" to a Time value for HeroUI TimeField
function timeToValue(timeStr) {
  if (!timeStr) return null
  try {
    return parseTime(timeToInputFormat(timeStr))
  } catch {
    return null
  }
}

// Convert a Time value back to "HH:MM" for the backend
function valueToTime(value) {
  if (!value) return ''
  return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
}

function TimeSetting({ label, value, onChange }) {
  return (
    <TimeField.Root
      value={timeToValue(value)}
      onChange={(time) => onChange(valueToTime(time))}
      hourCycle={24}
      fullWidth
      className="w-full"
    >
      <Label>{label}</Label>
      <TimeField.Group fullWidth className="w-full bg-neutral-100 dark:bg-neutral-900 shadow-none">
        <TimeField.Input>
          {(segment) => <TimeField.Segment segment={segment} />}
        </TimeField.Input>
      </TimeField.Group>
    </TimeField.Root>
  )
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openTime, setOpenTime] = useState('06:00')
  const [closeTime, setCloseTime] = useState('21:00')
  const [selectedDays, setSelectedDays] = useState([])

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/settings', {
        credentials: 'include',
        headers: {
          'key-request': 'web-admin',
        },
      })

      if (!response.ok) throw new Error('Failed to load settings')
      const data = await response.json()

      if (data.data) {
        // Convert "HH:MM:SS" from backend to "HH:MM" for the time fields
        setOpenTime(timeToInputFormat(data.data.attendance_open_time))
        setCloseTime(timeToInputFormat(data.data.attendance_close_time))
        setSelectedDays(data.data.open_days || [])
      }
    } catch (err) {
      toast.error('Failed to load settings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load settings on mount
  useEffect(() => {
    async function init() {
      await loadSettings()
    }
    init()
  }, [loadSettings])

  function toggleDay(day) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  async function handleSave() {
    if (!openTime || !closeTime) {
      toast.error('Please set both open and close times')
      return
    }

    if (selectedDays.length === 0) {
      toast.error('Please select at least one day')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'key-request': 'web-admin',
        },
        body: JSON.stringify({
          attendance_open_time: openTime,
          attendance_close_time: closeTime,
          open_days: selectedDays,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to save settings')
      }

      toast.success('Settings saved successfully')
      const data = await response.json()
      if (data.data) {
        // Update display format after save
        setOpenTime(timeToInputFormat(data.data.attendance_open_time))
        setCloseTime(timeToInputFormat(data.data.attendance_close_time))
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          <Icon data={Clock} size={28} />
          Settings
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Configure attendance time window and available days
        </p>
      </div>

      <div className="space-y-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        {/* Time Settings */}
        <div className="space-y-4">
          <TimeSetting
            label="Attendance Opens At (in app timezone)"
            value={openTime}
            onChange={setOpenTime}
          />

          <TimeSetting
            label="Attendance Closes At (in app timezone)"
            value={closeTime}
            onChange={setCloseTime}
          />
        </div>

        {/* Day Selection */}
        <div>
          <p className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Attendance Available On
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <label key={day.key} className="flex items-center gap-2 text-sm text-neutral-900 dark:text-neutral-100">
                <Checkbox
                  isSelected={selectedDays.includes(day.key)}
                  onChange={() => toggleDay(day.key)}
                >
                  <Checkbox.Content>
                    <Checkbox.Control className="bg-neutral-50 border border-neutral-200 size-4 rounded-sm before:rounded-sm dark:bg-neutral-800 dark:border-neutral-700">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {day.label}
                  </Checkbox.Content>
                </Checkbox>
              </label>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Note:</strong> These settings control when users can submit attendance and absence requests.
            Users will see a countdown timer and won't be able to submit outside these hours or on non-working days.
          </p>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 active:scale-95 disabled:opacity-50"
        >
          <Icon data={Check} size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Self security - separate section, operates on this admin only */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">
          <Icon data={Shield} size={22} />
          My Security
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Two-factor authentication for your own admin account. It cannot be applied to other admins.
        </p>
      </div>
      <SecuritySettings apiBase="/api/admin" />
    </div>
  )
}
