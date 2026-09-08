import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { Label, ListBox, Select } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import {
  Camera as CameraIcon,
  LocationArrow,
  TriangleExclamation,
  PaperPlane,
} from '@gravity-ui/icons'
import BackButton from '../components/BackButton.jsx'
import PageGuideOverlay from '../components/PageGuideOverlay.jsx'
import WaitingCountdown from '../components/WaitingCountdown.jsx'
import { submitAttendance, getSettings } from '../lib/api.js'
import { serverDelta, serverNow, parseAbsolute, formatDuration } from '../lib/serverTime.js'
import { isPageTipDone } from '../lib/userGuide.js'

const ATTENDANCE_STEPS = [
  {
    target: '[data-guide="camera-preview"]',
    title: 'Camera Preview',
    description: 'Your camera preview appears here. Photo is required for attendance.',
    placement: 'bottom',
  },
  {
    target: '[data-guide="take-attendance-btn"]',
    title: 'Submit Attendance',
    description: 'Tap this button to submit your attendance. Make sure you have granted camera and location permissions first.',
    placement: 'top',
  },
]

// Browsers only ever show the native permission dialog once. After the user
// has explicitly blocked a permission, calling the API again just fails
// silently instead of re-prompting - so we check the current state first and
// point the user to their browser settings when it's already blocked.
async function getPermissionState(name) {
  try {
    const status = await navigator.permissions.query({ name })
    return status.state // 'granted' | 'denied' | 'prompt'
  } catch {
    return null // Permissions API not supported for this name (e.g. Safari + camera)
  }
}

export default function Attendance() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // null = not checked yet, 'granted' | 'denied' once we know.
  const [locationStatus, setLocationStatus] = useState(null)
  const [cameraStatus, setCameraStatus] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)

  const [gpsCoords, setGpsCoords] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Countdown to attendance close time
  const [attendanceSettings, setAttendanceSettings] = useState(null)
  const [timeUntilClose, setTimeUntilClose] = useState(null)
  const [attendanceClosed, setAttendanceClosed] = useState(false)

  // Frozen frame captured when "Take Attendance!" is clicked.
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [capturedPreview, setCapturedPreview] = useState(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  // Stable ref callback: a fresh function identity every render makes React
  // detach/reattach the <video> element, which resets srcObject and makes the
  // preview flicker on every countdown tick. useCallback keeps it mounted.
  const setVideoElement = useCallback((el) => {
    videoRef.current = el
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current
    }
  }, [])

  async function requestLocation() {
    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      )
      setGpsCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
      setLocationStatus('granted')
    } catch {
      setLocationStatus('denied')
    }
  }

  async function requestCamera(mode = facingMode, deviceId = null) {
    try {
      stopStream()
      const constraints = {
        video: { facingMode: mode },
        audio: false,
      }
      if (deviceId) {
        constraints.video = { deviceId: { exact: deviceId } }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraStatus('granted')
    } catch {
      setCameraStatus('denied')
    }
  }

  async function enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter((d) => d.kind === 'videoinput')
      setAvailableCameras(cameras)
      if (cameras.length > 0 && !selectedCameraId) {
        setSelectedCameraId(cameras[0].deviceId)
      }
    } catch {
      console.error('Failed to enumerate cameras')
    }
  }

  function cameraLabel(camera, index) {
    const raw = (camera.label || '').toLowerCase()
    if (raw.includes('front') || raw.includes('user')) return 'Front camera'
    if (raw.includes('back') || raw.includes('rear') || raw.includes('environment')) return 'Back camera'
    if (index === 0) return 'Front camera'
    if (index === 1) return 'Back camera'
    return `Camera ${index + 1}`
  }

  async function captureFrame() {
    try {
      const video = videoRef.current
      if (!video || !video.videoWidth) return null
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) return null
      const file = new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' })
      return { file, previewUrl: URL.createObjectURL(blob) }
    } catch (err) {
      console.error('captureFrame error:', err)
      return null
    }
  }

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

  // Offset between the server clock (TIMEZONE_APP) and this device, measured
  // on every settings fetch. All open/close math uses server time so clients
  // in any timezone see the same window as the server.
  const deltaRef = useRef(0)
  // Tracks the last closed state so a closed -> open transition refreshes
  // settings from the backend immediately (fresh close time), instead of
  // waiting for the next poll.
  const wasClosedRef = useRef(null)

  function updateCountdown(settings) {
    if (!settings) return

    const now = serverNow(deltaRef.current)
    const nextOpen = parseAbsolute(settings.next_open)
    const closeAt = parseAbsolute(settings.close_at)

    let closed
    if (wasClosedRef.current === null) {
      closed = !(settings.is_open === true)
      if (settings.is_open === undefined) {
        closed = attendanceIsClosed(settings, now)
      }
    } else if (wasClosedRef.current && nextOpen && now >= nextOpen) {
      closed = false
    } else if (!wasClosedRef.current && closeAt && now >= closeAt) {
      closed = true
    } else if (!nextOpen || !closeAt) {
      closed = attendanceIsClosed(settings, now)
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
      setAttendanceClosed(true)
      if (nextOpen && nextOpen > now) {
        setTimeUntilClose(`Opens in ${formatDuration(nextOpen - now)}`)
      } else {
        setTimeUntilClose(closedFallbackText(settings, now))
      }
      return
    }

    setAttendanceClosed(false)
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
  // The backend `is_open` flag is only a stale snapshot, so it is ignored.
  function attendanceIsClosed(settings, now) {
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

  function closedFallbackText(settings, now) {
    const openDays = (settings.open_days || []).map((d) => String(d).toLowerCase())
    const daysAhead = nextOpenDayDistance(now, openDays)
    if (daysAhead <= 1) return 'Attendance will be taken again tomorrow'
    return `There are ${daysAhead} more days of Attendance`
  }

  function nextOpenDayDistance(fromDate, openDays, startOffset = 0) {
    for (let i = startOffset; i < 8; i++) {
      const d = new Date(fromDate.getTime() + i * 86400000)
      const name = d.toLocaleString('en-US', { weekday: 'long' }).toLowerCase()
      if (openDays.includes(name)) return i <= 0 ? 1 : i
    }
    return 1
  }

  useEffect(() => {
    requestLocation()
    requestCamera().then(() => enumerateCameras())
    loadSettings()
    return () => stopStream()
  }, [])

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      updateCountdown(attendanceSettings)
    }, 1000)
    return () => clearInterval(interval)
  }, [attendanceSettings])

  // "Attendance has been taken!" auto-redirects to home after 3 seconds,
  // counting down 3, 2, 1 in the message as it goes.
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

  async function handleRequestLocationPermission() {
    const state = await getPermissionState('geolocation')
    if (state === 'denied') {
      toast.error(
        'Location permission is blocked. Please enable it from your browser\'s site settings, then reload this page.',
      )
      return
    }
    requestLocation()
  }

  async function handleRequestCameraPermission() {
    const state = await getPermissionState('camera')
    if (state === 'denied') {
      toast.error(
        'Camera permission is blocked. Please enable it from your browser\'s site settings, then reload this page.',
      )
      return
    }
    requestCamera()
  }

  function handleSelectCamera(deviceId) {
    setSelectedCameraId(deviceId)
    requestCamera(facingMode, deviceId)
  }

  async function handleTakeAttendance() {
    if (attendanceClosed) {
      toast.error('Attendance is currently closed')
      return
    }

    // Photo is mandatory - capture it
    if (cameraStatus === 'granted' && videoRef.current && streamRef.current) {
      const captured = await captureFrame()
      if (captured) {
        setCapturedPhoto(captured.file)
        setCapturedPreview(captured.previewUrl)
        stopStream()
      } else {
        toast.error('Failed to capture photo')
        return
      }
    } else {
      toast.error('Camera is not available')
      return
    }
    setConfirmOpen(true)
  }

  async function handleConfirmAttendance() {
    if (!gpsCoords) {
      toast.error('GPS location not available')
      return
    }

    if (!capturedPhoto) {
      toast.error('Photo is required for attendance')
      return
    }

    setSubmitting(true)

    try {
      // Photo is now mandatory
      await submitAttendance({
        latitude: String(gpsCoords.latitude),
        longitude: String(gpsCoords.longitude),
        photo: capturedPhoto,
      })

      toast.success('Attendance submitted successfully!')
      setConfirmOpen(false)
      stopStream()
      setSubmitted(true)
    } catch (err) {
      toast.error(err.message || 'Failed to submit attendance')
      console.error('submitAttendance error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const permissionsChecked = locationStatus !== null
  const permissionsReady = locationStatus === 'granted'

  if (submitted) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center px-6">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <Icon data={PaperPlane} size={32} className="text-neutral-900 dark:text-neutral-100" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Attendance has been taken!</h1>
          <p className="mt-2 max-w-[260px] text-center text-sm text-neutral dark:text-neutral-400">
            The page will automatically redirect to the home page after {countdown} second
          </p>
        </div>
      </main>
    )
  }

  if (!permissionsChecked) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
          <BackButton label="Attendance" />
          <span className="h-8 w-8 shrink-0" />
        </header>

        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div className="animate-pulse">
            <div className="aspect-square w-full rounded-2xl bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-4 h-4 w-56 max-w-full rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-4 h-11 w-full rounded-xl bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
      </main>
    )
  }

  // Closed takes precedence over missing permissions: no point asking for
  // camera/location when submissions are not accepted right now.
  if (attendanceClosed) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
          <BackButton label="Attendance" />
          <span className="h-8 w-8 shrink-0" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[80px]">
          <WaitingCountdown
            title="Attendance"
            settings={attendanceSettings}
            countdownText={timeUntilClose}
          />
        </div>
      </main>
    )
  }

  if (permissionsChecked && !permissionsReady) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
          <BackButton label="Attendance" />
          <span className="h-8 w-8 shrink-0" />
        </header>

        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Icon data={TriangleExclamation} size={28} className="text-neutral-900 dark:text-neutral-100" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Permissions Required</h1>
            <p className="mt-2 max-w-[280px] text-center text-sm text-neutral dark:text-neutral-400">
              Several permissions are required before you can check in. Please grant them first
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleRequestLocationPermission}
                className={`flex cursor-pointer items-center gap-1.5 text-sm font-medium ${
                  locationStatus === 'granted' ? 'text-success' : 'text-danger'
                }`}
              >
                <Icon data={LocationArrow} size={14} />
                Location Permission
              </button>
              <button
                type="button"
                onClick={handleRequestCameraPermission}
                className={`flex cursor-pointer items-center gap-1.5 text-sm font-medium ${
                  cameraStatus === 'granted' ? 'text-success' : 'text-danger'
                }`}
              >
                <Icon data={CameraIcon} size={14} />
                Camera Permission
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
        <BackButton label="Attendance" />
        <span className="h-8 w-8 shrink-0" />
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 pb-[80px]">

        <div className="flex flex-1 flex-col justify-center">
        {permissionsReady && (
          <div className="mt-6">
            {cameraStatus === 'granted' ? (
              capturedPhoto ? (
                <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
                  <img
                    src={capturedPreview}
                    alt="Captured attendance"
                    className="aspect-square w-full object-cover"
                  />
                </div>
              ) : (
              <div data-guide="camera-preview" className="overflow-hidden rounded-2xl bg-neutral-900">
                  <video
                    ref={setVideoElement}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-square w-full object-cover"
                  />
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <Icon data={CameraIcon} size={32} className="text-neutral-900 dark:text-neutral-100" />
                </div>
                <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Camera Required</h1>
                <p className="mt-2 max-w-[260px] text-center text-sm text-neutral dark:text-neutral-400">
                  Camera is required for attendance. Please allow camera access from your browser&apos;s site settings, then reload this page
                </p>
              </div>
            )}

            {timeUntilClose && (
              <div className="mt-4 rounded-lg bg-neutral-100 p-3 text-center dark:bg-neutral-800">
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Time until attendance closes: <span className="font-bold text-neutral-900 dark:text-neutral-100">{timeUntilClose}</span>
                </p>
              </div>
            )}

            {cameraStatus === 'granted' && availableCameras.length > 1 && !attendanceClosed && (
              <div className="mt-4">
                <Select
                  selectedKey={selectedCameraId}
                  onSelectionChange={(key) => handleSelectCamera(String(key))}
                  fullWidth
                >
                  <Label>Select a camera</Label>
                  <Select.Trigger className="bg-neutral-100 dark:bg-neutral-900 shadow-none">
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {availableCameras.map((cam, idx) => (
                        <ListBox.Item key={cam.deviceId} id={cam.deviceId} textValue={cameraLabel(cam, idx)}>
                          <Label>{cameraLabel(cam, idx)}</Label>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            )}

            <button
              data-guide="take-attendance-btn"
              type="button"
              onClick={handleTakeAttendance}
              disabled={cameraStatus !== 'granted'}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon data={PaperPlane} size={16} />
              Take Attendance!
            </button>
          </div>
        )}
        </div>
      </div>

      <Drawer.Root
        open={confirmOpen}
        onOpenChange={(next) => {
          if (submitting) return
          setConfirmOpen(next)
          if (!next && capturedPhoto) {
            // Canceled - discard the frozen frame and resume the live camera
            setCapturedPhoto(null)
            setCapturedPreview(null)
            requestCamera()
          }
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
              Click "Attendance" to submit your current attendance, including a photo if you
              select the option with a photo
            </p>
            <button
              type="button"
              onClick={handleConfirmAttendance}
              disabled={submitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting...
                </>
              ) : (
                'Attendance'
              )}
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {!isPageTipDone('attendance') && (
        <PageGuideOverlay page="attendance" steps={ATTENDANCE_STEPS} />
      )}
    </main>
  )
}
