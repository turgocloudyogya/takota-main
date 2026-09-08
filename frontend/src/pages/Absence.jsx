import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { Icon } from '@gravity-ui/uikit'
import { Files, Xmark, PaperPlane, TriangleExclamation } from '@gravity-ui/icons'
import { Label, ListBox, Select, TextArea, DatePicker, DateField, Calendar, Checkbox } from '@heroui/react'
import { parseDate, today, getLocalTimeZone } from '@internationalized/date'
import BackButton from '../components/BackButton.jsx'
import PageGuideOverlay from '../components/PageGuideOverlay.jsx'
import WaitingCountdown from '../components/WaitingCountdown.jsx'
import { submitAbsence, getSettings } from '../lib/api.js'
import { serverDelta, serverNow, parseAbsolute, formatDuration } from '../lib/serverTime.js'
import { isPageTipDone } from '../lib/userGuide.js'

const ABSENCE_STEPS = [
  {
    target: '[data-guide="absence-textarea"]',
    title: 'Reason for Absence',
    description: 'Enter a brief explanation for why you are not present today.',
    placement: 'bottom',
  },
  {
    target: '[data-guide="absence-file-upload"]',
    title: 'Attach Document',
    description: "Optionally attach a photo or document to support your absence request (e.g., a doctor's note).",
    placement: 'bottom',
  },
  {
    target: '[data-guide="absence-reason-select"]',
    title: 'Select Reason Type',
    description: 'Choose whether this is an Absence/Leave or a Sick leave.',
    placement: 'top',
  },
  {
    target: '[data-guide="absence-submit-btn"]',
    title: 'Submit Absence',
    description: "After filling in the details, tap this button to submit your absence request.",
    placement: 'top',
  },
]

// The 2 choices shown under "Select a reason", per design.
// Backend expects: 'sick' or 'permission'
const REASON_OPTIONS = [
  { id: 'permission', label: 'Absence / Leave' },
  { id: 'sick', label: 'Sick' },
]

function getFileExt(name = '') {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE'
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)}KB`
  return `${Math.round(kb / 1024)}MB`
}

export default function Absence() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [reasonText, setReasonText] = useState('')
  const [file, setFile] = useState(null)
  const [reasonType, setReasonType] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [isDragging, setIsDragging] = useState(false)

  // Multi-day absence: the period starts today, the user only picks the end date
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [absenceEndDate, setAbsenceEndDate] = useState('')

  function endDateValue() {
    if (!absenceEndDate) return null
    try {
      const [y, m, d] = absenceEndDate.split('-').map(Number)
      return parseDate(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    } catch {
      return null
    }
  }

  function endDateBounds() {
    const zone = getLocalTimeZone()
    const min = today(zone).add({ days: 1 })
    const max = today(zone).add({ days: 90 })
    return { min, max }
  }

  // Attendance time settings and countdown
  const [attendanceSettings, setAttendanceSettings] = useState(null)
  const [timeUntilClose, setTimeUntilClose] = useState(null)
  const [absenceClosed, setAbsenceClosed] = useState(false)

  async function loadSettings() {
    try {
      const response = await getSettings()
      deltaRef.current = serverDelta(response.data)
      setAttendanceSettings(response.data)
      updateCountdown(response.data)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  const wasClosedRef = useRef(null)
  const deltaRef = useRef(0)

  function updateCountdown(settings) {
    if (!settings) return

    const now = serverNow(deltaRef.current)
    const nextOpen = parseAbsolute(settings.next_open)
    const closeAt = parseAbsolute(settings.close_at)

    let closed
    if (wasClosedRef.current === null) {
      closed = !(settings.is_open === true)
      if (settings.is_open === undefined) {
        closed = absenceIsClosed(settings, now)
      }
    } else if (wasClosedRef.current && nextOpen && now >= nextOpen) {
      closed = false
    } else if (!wasClosedRef.current && closeAt && now >= closeAt) {
      closed = true
    } else if (!nextOpen || !closeAt) {
      closed = absenceIsClosed(settings, now)
    } else {
      closed = wasClosedRef.current
    }

    if (wasClosedRef.current === true && !closed) {
      loadSettings()
    }
    if (wasClosedRef.current === false && closed) {
      loadSettings()
    }
    wasClosedRef.current = closed

    if (closed) {
      setAbsenceClosed(true)
      if (nextOpen && nextOpen > now) {
        setTimeUntilClose(`Opens in ${formatDuration(nextOpen - now)}`)
      } else {
        setTimeUntilClose('Attendance will be taken again tomorrow')
      }
      return
    }

    setAbsenceClosed(false)
    if (closeAt && closeAt > now) {
      setTimeUntilClose(formatDuration(closeAt - now))
    } else {
      const closeStr = settings.attendance_close_time || settings.close_time || '21:00:00'
      const [closeHour, closeMinute] = closeStr.split(':')
      const closeTime = new Date()
      closeTime.setHours(parseInt(closeHour), parseInt(closeMinute), 0)
      const diff = closeTime - now
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeUntilClose(`${hours}h ${minutes}m ${seconds}s`)
    }
  }

  // Evaluated live every tick from the current time, so the page flips to
  // open automatically the moment the opening time passes (no reload needed).
  function absenceIsClosed(settings, now) {
    const openDays = (settings.open_days || []).map((d) => String(d).toLowerCase())
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' }).toLowerCase()
    if (!openDays.includes(currentDay)) return true
    const openStr = settings.attendance_open_time || settings.open_time || '06:00:00'
    const closeStr = settings.attendance_close_time || settings.close_time || '21:00:00'
    const [openHour, openMinute] = openStr.split(':')
    const [closeHour, closeMinute] = closeStr.split(':')
    const openTime = new Date(now)
    openTime.setHours(parseInt(openHour), parseInt(openMinute), 0)
    const closeTime = new Date(now)
    closeTime.setHours(parseInt(closeHour), parseInt(closeMinute), 0)
    return now < openTime || now >= closeTime
  }

  // "Absence has been taken!" auto-redirects to home after 3 seconds,
  // counting down 3, 2, 1 in the message as it goes.
  useEffect(() => {
    loadSettings()
    const settingsInterval = setInterval(loadSettings, 60000)
    const countdownInterval = setInterval(() => {
      setAttendanceSettings((prev) => {
        updateCountdown(prev)
        return prev
      })
    }, 1000)
    return () => {
      clearInterval(settingsInterval)
      clearInterval(countdownInterval)
    }
  }, [])

  function handleFilePick(e) {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
    e.target.value = ''
  }

  function handleRemoveFile(e) {
    e.stopPropagation()
    setFile(null)
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) setFile(droppedFile)
  }, [])

  function handleTakeAbsence() {
    if (!reasonText.trim()) {
      toast.error('Please explain why you are not present at this time.')
      return
    }
    if (!reasonType) {
      toast.error('Please select a reason.')
      return
    }
    if (isMultiDay) {
      if (!absenceEndDate) {
        toast.error('Please select an end date for multi-day absence.')
        return
      }
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrow = new Date(todayStart)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const end = new Date(`${absenceEndDate}T00:00:00`)
      if (end < tomorrow) {
        toast.error('End date must be at least tomorrow.')
        return
      }
      const maxDate = new Date(todayStart)
      maxDate.setDate(maxDate.getDate() + 90)
      if (end > maxDate) {
        toast.error('Absence can be requested up to 3 months in advance.')
        return
      }
    }
    setConfirmOpen(true)
  }

  async function handleConfirmAbsence() {
    setSubmitting(true)

    try {
      const data = {
        option: reasonType,
        reason: reasonText.trim(),
        file: file || undefined,
      }

      if (isMultiDay && absenceEndDate) {
        data.absence_end_date = absenceEndDate
      }

      await submitAbsence(data)

      toast.success('Absence submitted successfully!')
      setConfirmOpen(false)
      setSubmitted(true)
    } catch (err) {
      toast.error(err.message || 'Failed to submit absence')
      console.error('submitAbsence error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!submitted) return
    const interval = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : c))
    }, 1000)
    const timer = setTimeout(() => navigate('/main'), 3000)
    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [submitted, navigate])

  if (submitted) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center px-6">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-500/15">
            <Icon data={PaperPlane} size={32} className="text-orange-500" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Absence has been taken!</h1>
          <p className="mt-2 max-w-[260px] text-center text-sm text-neutral dark:text-neutral-400">
            The page will automatically redirect to the home page after {countdown} second
          </p>
        </div>
      </main>
    )
  }

  if (absenceClosed) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
          <BackButton label="Absence" />
          <span className="h-8 w-8 shrink-0" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[80px]">
          <WaitingCountdown
            title="Absence"
            settings={attendanceSettings}
            countdownText={timeUntilClose}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
        <BackButton label="Absence" />
        <span className="h-8 w-8 shrink-0" />
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 pb-[80px]">
        <div className="flex flex-1 flex-col justify-center">
        <p className="text-sm text-neutral dark:text-neutral-400">
          Please explain why you are not present at this time
        </p>

        <TextArea
          data-guide="absence-textarea"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="Enter the reason for your absence…"
          rows={5}
          className="mt-3 w-full resize-none rounded-xl bg-neutral-100 dark:bg-neutral-900 px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500 shadow-none"
        />

        <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" />

        {file ? (
          <div className="relative mt-3 flex flex-col items-center justify-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 px-4 py-6 cursor-pointer">
            <button
              type="button"
              onClick={handleRemoveFile}
              aria-label="Remove attachment"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm cursor-pointer"
            >
              <Icon data={Xmark} size={14} />
            </button>
            <Icon data={Files} size={28} className="text-neutral-700 dark:text-neutral-300" />
            <p className="w-full text-center text-xs text-neutral-700 truncate overflow-hidden dark:text-neutral-300">
              {file.name}
              <br />
              {getFileExt(file.name)} · {formatFileSize(file.size)}
            </p>
          </div>
        ) : (
          <button
            data-guide="absence-file-upload"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors cursor-pointer ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-neutral-100 dark:bg-neutral-900'
            }`}
          >
            <Icon data={Files} size={28} className={isDragging ? 'text-primary' : 'text-neutral-400 dark:text-neutral-500'} />
            <span className="text-center text-xs text-neutral dark:text-neutral-400">
              {isDragging ? 'Drop file here' : 'Attach only 1 relevant photo or document (optional)'}
            </span>
          </button>
        )}

        <div data-guide="absence-reason-select" className="mt-3">
          <Select
            selectedKey={reasonType}
            onSelectionChange={(key) => setReasonType(String(key))}
            fullWidth
          >
            <Label>Select a reason</Label>
            <Select.Trigger className="bg-neutral-100 dark:bg-neutral-900 shadow-none">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {REASON_OPTIONS.map((option) => (
                  <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                    <Label>{option.label}</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="mt-4 mb-1">
          <Checkbox
            isSelected={isMultiDay}
            onChange={(checked) => {
              setIsMultiDay(checked)
              if (!checked) setAbsenceEndDate('')
            }}
          >
            <Checkbox.Content>
              <Checkbox.Control className="bg-neutral-50 border border-neutral-200 size-4 rounded-sm before:rounded-sm dark:bg-neutral-800 dark:border-neutral-700">
                <Checkbox.Indicator />
              </Checkbox.Control>
              If more than 1 day
            </Checkbox.Content>
          </Checkbox>
        </div>

        {isMultiDay && (
          <div className="mt-2">
            <DatePicker
              value={endDateValue()}
              onChange={(date) => {
                if (!date) {
                  setAbsenceEndDate('')
                  return
                }
                setAbsenceEndDate(`${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`)
              }}
              minValue={endDateBounds().min}
              maxValue={endDateBounds().max}
              fullWidth
              className="w-full"
            >
              <Label>End date</Label>
              <DateField.Group fullWidth className="w-full bg-neutral-100 dark:bg-neutral-900 shadow-none">
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Choose end date">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                  </Calendar.Grid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </div>
        )}

        {timeUntilClose && (
          <div className={`mt-4 rounded-lg p-3 text-center ${
            absenceClosed
              ? 'bg-red-100 dark:bg-red-500/15'
              : 'bg-neutral-100 dark:bg-neutral-800'
          }`}>
            <p className={`text-xs font-medium ${
              absenceClosed
                ? 'text-red-600 dark:text-red-400'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}>
              Time until absence closes: <span className="font-bold">{timeUntilClose}</span>
            </p>
          </div>
        )}

        <button
          data-guide="absence-submit-btn"
          type="button"
          onClick={handleTakeAbsence}
          disabled={absenceClosed}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon data={PaperPlane} size={16} />
          Take Absence!
        </button>
        </div>
      </div>

      <Drawer.Root
        open={confirmOpen}
        onOpenChange={(next) => {
          if (submitting) return
          setConfirmOpen(next)
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-2xl bg-white p-5 pb-8 outline-none dark:bg-neutral-900">
            <Drawer.Handle className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-app-border/40" />
            <Drawer.Title className="mb-2 text-base font-bold text-neutral-900 dark:text-neutral-100">
              Are you sure?
            </Drawer.Title>
            <p className="mb-4 text-sm text-neutral dark:text-neutral-400">
              Click "Absence" to submit your current absence, including a file if you upload the
              file for relevant document
            </p>
            <button
              type="button"
              onClick={handleConfirmAbsence}
              disabled={submitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting…
                </>
              ) : (
                'Absence'
              )}
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {!isPageTipDone('absence') && (
        <PageGuideOverlay page="absence" steps={ABSENCE_STEPS} />
      )}
    </main>
  )
}