import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { Icon } from '@gravity-ui/uikit'
import {
  Camera as CameraIcon,
  LocationArrow,
  TriangleExclamation,
  PaperPlane,
} from '@gravity-ui/icons'
import BackButton from '../components/BackButton.jsx'
import { submitAttendance } from '../lib/api.js'

// Browsers only ever show the native permission dialog once. After the user
// has explicitly blocked a permission, calling the API again just fails
// silently instead of re-prompting — so we check the current state first and
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
  const [useCameraTracking, setUseCameraTracking] = useState(true)

  const [gpsCoords, setGpsCoords] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Frozen frame captured when "Take Attendance!" is clicked.
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [capturedPreview, setCapturedPreview] = useState(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  // Attaches the active camera stream once the <video> element is mounted.
  // Without this the preview stays black when getUserMedia resolves before
  // the element renders (e.g. when permission was granted from the
  // permissions screen).
  function setVideoElement(el) {
    videoRef.current = el
    if (el && streamRef.current) {
      el.srcObject = streamRef.current
    }
  }

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

  async function requestCamera(mode = facingMode) {
    try {
      stopStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraStatus('granted')
    } catch {
      setCameraStatus('denied')
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- these call browser
       permission APIs (geolocation/camera) and only set state once their
       promises resolve; they are not synchronous setState calls. */
    requestLocation()
    requestCamera()
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => stopStream()
    // Only run once on mount — facingMode changes are handled by handleToggleCamera.
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- permission requests intentionally run once on mount; facingMode changes go through handleToggleCamera. */
  }, [])

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

  function handleToggleCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    requestCamera(next)
  }

  // Captures the current camera frame at full sensor resolution and returns
  // both the JPEG File for upload and a data URL for the frozen preview.
  function captureFrame() {
    const video = videoRef.current
    if (!video || !streamRef.current || !video.videoWidth) return Promise.resolve(null)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    const previewUrl = canvas.toDataURL('image/jpeg', 0.85)

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve({
          file: new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }),
          previewUrl,
        })
      }, 'image/jpeg', 0.85)
    })
  }

  async function handleTakeAttendance() {
    // Freeze the current frame at full resolution right now, so the uploaded
    // photo reflects the moment "Take Attendance!" was pressed, not submit.
    if (useCameraTracking && cameraStatus === 'granted' && videoRef.current && streamRef.current) {
      const captured = await captureFrame()
      if (captured) {
        setCapturedPhoto(captured.file)
        setCapturedPreview(captured.previewUrl)
        stopStream()
      }
    }
    setConfirmOpen(true)
  }

  async function handleConfirmAttendance() {
    if (!gpsCoords) {
      toast.error('GPS location not available')
      return
    }

    setSubmitting(true)

    try {
      // Use the frame captured when "Take Attendance!" was clicked.
      await submitAttendance({
        latitude: String(gpsCoords.latitude),
        longitude: String(gpsCoords.longitude),
        photo: useCameraTracking ? capturedPhoto || undefined : undefined,
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
      <main className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100">
            <Icon data={PaperPlane} size={32} className="text-neutral-900" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Attendance has been taken!</h1>
          <p className="mt-2 max-w-[260px] text-center text-sm text-neutral">
            The page will automatically redirect to the home page after {countdown} second
          </p>
        </div>
      </main>
    )
  }

  if (!permissionsChecked) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
          <BackButton label="Attendance" />
          <span className="h-8 w-8 shrink-0" />
        </header>

        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div className="animate-pulse">
            <div className="aspect-square w-full rounded-2xl bg-neutral-200" />
            <div className="mt-4 h-4 w-56 max-w-full rounded bg-neutral-200" />
            <div className="mt-4 h-11 w-full rounded-xl bg-neutral-200" />
          </div>
        </div>
      </main>
    )
  }

  if (permissionsChecked && !permissionsReady) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
          <BackButton label="Attendance" />
          <span className="h-8 w-8 shrink-0" />
        </header>

        <div className="flex flex-1 flex-col justify-center px-6 py-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100">
              <Icon data={TriangleExclamation} size={28} className="text-neutral-900" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900">Permissions Required</h1>
            <p className="mt-2 max-w-[280px] text-center text-sm text-neutral">
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
        <BackButton label="Attendance" />
        <span className="h-8 w-8 shrink-0" />
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 py-6">
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
                <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
                  <video
                    ref={setVideoElement}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center gap-1.5 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-4 pb-3 pt-8 text-xs font-medium text-white"
                  >
                    <Icon data={CameraIcon} size={14} />
                    Change to {facingMode === 'environment' ? 'front' : 'back'} camera
                  </button>
                </div>
              )
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-neutral-900 text-center">
                <Icon data={CameraIcon} size={28} className="text-white/50" />
                <p className="mt-3 max-w-[220px] text-sm text-white/70">
                  Camera is off. Start it to attach a photo to your attendance
                </p>
                <button
                  type="button"
                  onClick={handleRequestCameraPermission}
                  className="mt-4 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition active:scale-[0.98]"
                >
                  Start Camera
                </button>
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-neutral-900">
              <input
                type="checkbox"
                checked={useCameraTracking}
                onChange={(e) => setUseCameraTracking(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              Use the camera for attendance tracking
            </label>

            <button
              type="button"
              onClick={handleTakeAttendance}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              <Icon data={PaperPlane} size={16} />
              Take Attendance!
            </button>
          </div>
        )}
      </div>

      <Drawer.Root
        open={confirmOpen}
        onOpenChange={(next) => {
          if (submitting) return
          setConfirmOpen(next)
          if (!next && capturedPhoto) {
            // Canceled — discard the frozen frame and resume the live camera
            setCapturedPhoto(null)
            setCapturedPreview(null)
            requestCamera()
          }
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-2xl bg-white p-5 pb-8 outline-none">
            <Drawer.Handle className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-app-border/40" />
            <Drawer.Title className="mb-2 text-base font-bold text-neutral-900">
              Are you sure?
            </Drawer.Title>
            <p className="mb-4 text-sm text-neutral">
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
                  Submitting…
                </>
              ) : (
                'Attendance'
              )}
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </main>
  )
}