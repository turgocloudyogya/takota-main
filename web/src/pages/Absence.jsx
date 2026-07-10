import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { Icon } from '@gravity-ui/uikit'
import { ChevronLeft, ChevronDown, Files, Xmark, PaperPlane } from '@gravity-ui/icons'

// The 2 choices shown under "Select a reason", per design.
const REASON_OPTIONS = [
  { value: 'izin', label: 'Absence / Izin' },
  { value: 'sakit', label: 'Sick / Sakit' },
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
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reasonType, setReasonType] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // "Absence has been taken!" auto-redirects to home after 3 seconds,
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

  function handleFilePick(e) {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
    e.target.value = ''
  }

  function handleRemoveFile(e) {
    e.stopPropagation()
    setFile(null)
  }

  function handleSelectReasonType(option) {
    setReasonType(option)
    setReasonOpen(false)
  }

  function handleTakeAbsence() {
    if (!reasonText.trim()) {
      toast.error('Please explain why you are not present at this time.')
      return
    }
    if (!reasonType) {
      toast.error('Please select a reason.')
      return
    }
    setConfirmOpen(true)
  }

  function handleConfirmAbsence() {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setConfirmOpen(false)
      setSubmitted(true)
    }, 1200)
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen w-full justify-center px-6 pt-8 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col items-center pt-24 text-center md:pt-0">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-100">
            <Icon data={PaperPlane} size={32} className="text-orange-500" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Absence has been taken!</h1>
          <p className="mt-2 max-w-[260px] text-center text-sm text-neutral">
            The page will automatically redirect to the home page after {countdown} second
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen w-full justify-center px-5 pb-10 pt-8 md:items-center md:pt-0">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium text-neutral-700"
        >
          <Icon data={ChevronLeft} size={18} />
          Absence
        </button>

        <div className="mt-16">
          <p className="text-sm text-neutral">
            Please explain why you are not present at this time
          </p>

          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Enter the reason for your absence…"
            rows={5}
            className="mt-3 w-full resize-none rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />

          <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" />

          {file ? (
            <div className="relative mt-3 flex flex-col items-center justify-center gap-2 rounded-xl bg-orange-100 px-4 py-6">
              <button
                type="button"
                onClick={handleRemoveFile}
                aria-label="Remove attachment"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm"
              >
                <Icon data={Xmark} size={14} />
              </button>
              <Icon data={Files} size={28} className="text-neutral-700" />
              <p className="text-center text-xs text-neutral-700">
                {file.name}
                <br />
                {getFileExt(file.name)} · {formatFileSize(file.size)}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-6"
            >
              <Icon data={Files} size={28} className="text-neutral-400" />
              <span className="text-center text-xs text-neutral">
                Attach only 1 relevant photo or document (optional)
              </span>
            </button>
          )}

          <div className="relative z-20 mt-3">
            <button
              type="button"
              onClick={() => setReasonOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-left text-sm text-neutral-900"
            >
              <Icon
                data={ChevronDown}
                size={14}
                className={`shrink-0 text-neutral transition-transform ${reasonOpen ? 'rotate-180' : ''}`}
              />
              {reasonType ? reasonType.label : 'Select a reason'}
            </button>

            {reasonOpen && (
              <div className="absolute inset-x-0 top-full z-30 mt-1 flex flex-col overflow-hidden rounded-xl shadow-lg">
                {REASON_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelectReasonType(option)}
                    className={`w-full px-4 py-3 text-left text-sm transition ${
                      reasonType?.value === option.value
                        ? 'bg-orange-500 text-white'
                        : 'bg-neutral-100 text-neutral-900 hover:bg-orange-500 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleTakeAbsence}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
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
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-2xl bg-white p-5 pb-8 outline-none">
            <Drawer.Handle className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-app-border/40" />
            <Drawer.Title className="mb-2 text-base font-bold text-neutral-900">
              Are you sure?
            </Drawer.Title>
            <p className="mb-4 text-sm text-neutral">
              Click "Absence" to submit your current absence, including a file if you upload the
              file for relevant document
            </p>
            <button
              type="button"
              onClick={handleConfirmAbsence}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-80"
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
    </main>
  )
}