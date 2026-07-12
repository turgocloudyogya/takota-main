import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { Icon } from '@gravity-ui/uikit'
import {
  ChevronLeft,
  Camera as CameraIcon,
  LocationArrow,
  TriangleExclamation,
  PaperPlane,
} from '@gravity-ui/icons'
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

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
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
    requestCamera(facingMode)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => stopStream()
    // Only run once on mount — facingMode changes are handled by handleToggleCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleTakeAttendance() {
    setConfirmOpen(true)
  }

  async function handleConfirmAttendance() {
    if (!gpsCoords) {
      toast.error('GPS location not available')
      return
    }

    setSubmitting(true)

    try {
      // Capture photo from video stream if camera tracking is enabled
      let photoFile = null
      if (useCameraTracking && videoRef.current && streamRef.current) {
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0)
        
        // Convert canvas to blob
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.85)
        })
        
        if (blob) {
          photoFile = new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' })
        }
      }

      // Call API
      await submitAttendance({
        latitude: String(gpsCoords.latitude),
        longitude: String(gpsCoords.longitude),
        photo: photoFile,
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

  const permissionsChecked = locationStatus !== null && cameraStatus !== null
  const permissionsReady = locationStatus === 'granted' && cameraStatus === 'granted'

  if (submitted) {
    return (
      <main className="flex min-h-screen w-full justify-center px-6 pt-8 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col items-center pt-24 text-center md:pt-0">
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
      <main className="flex min-h-screen w-full justify-center px-5 pb-10 pt-8">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-medium text-neutral-700"
          >
            <Icon data={ChevronLeft} size={18} />
            Attendance
          </button>

          <div className="mt-16 animate-pulse">
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
      <main className="flex min-h-screen w-full justify-center px-5 pb-10 pt-8">
        <div className="flex w-full max-w-md flex-1 flex-col">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-medium text-neutral-700"
          >
            <Icon data={ChevronLeft} size={18} />
            Attendance
          </button>

          <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
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
                className={`flex items-center gap-1.5 text-sm font-medium ${
                  locationStatus === 'granted' ? 'text-success' : 'text-danger'
                }`}
              >
                <Icon data={LocationArrow} size={14} />
                Location Permission
              </button>
              <button
                type="button"
                onClick={handleRequestCameraPermission}
                className={`flex items-center gap-1.5 text-sm font-medium ${
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
    <main className="flex min-h-screen w-full justify-center px-5 pb-10 pt-8">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium text-neutral-700"
        >
          <Icon data={ChevronLeft} size={18} />
          Attendance
        </button>

        {permissionsReady && (
          <div className="mt-16">
            <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={handleToggleCamera}
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-4 pb-3 pt-8 text-xs font-medium text-white"
              >
                <Icon data={CameraIcon} size={14} />
                Change to {facingMode === 'environment' ? 'front' : 'back'} camera
              </button>
            </div>

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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
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