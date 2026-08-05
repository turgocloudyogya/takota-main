import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { Icon } from '@gravity-ui/uikit'
import { Files, Xmark, PaperPlane } from '@gravity-ui/icons'
import { Label, ListBox, Select, TextArea } from '@heroui/react'
import BackButton from '../components/BackButton.jsx'
import PageGuideOverlay from '../components/PageGuideOverlay.jsx'
import { submitAbsence } from '../lib/api.js'
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
    setConfirmOpen(true)
  }

  async function handleConfirmAbsence() {
    setSubmitting(true)

    try {
      await submitAbsence({
        option: reasonType,
        reason: reasonText.trim(),
        file: file || undefined,
      })

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

        <button
          data-guide="absence-submit-btn"
          type="button"
          onClick={handleTakeAbsence}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] cursor-pointer"
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