import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { ArrowRightFromSquare, Paperclip } from '@gravity-ui/icons'
import { getUserHome, logout } from '../lib/api.js'
import { isPageTipDone } from '../lib/userGuide.js'
import AbsenceCard from '../components/AbsenceCard.jsx'
import AttendanceSheet from '../components/AttendanceSheet.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import PageGuideOverlay from '../components/PageGuideOverlay.jsx'
import { ConfirmDialog } from '../components/Modals.jsx'

const MAIN_STEPS = [
  {
    target: '[data-guide="greeting"]',
    title: 'Welcome to Takota',
    description: 'This is your home screen. You can see your attendance status and absence history at a glance.',
    placement: 'bottom',
  },
  {
    target: '[data-guide="today-status"]',
    title: "Today's Status",
    description: "Your attendance status for today appears here. If you haven't checked in yet, it will show as empty.",
    placement: 'bottom',
  },
  {
    target: '[data-guide="absence-list"]',
    title: 'Absence History',
    description: 'Your recent leave and sick submissions are listed here with their approval status.',
    placement: 'top',
  },
  {
    target: '[data-guide="attendance-button"]',
    title: 'Check In',
    description: 'Tap this button to open the attendance menu where you can check in, submit leave, or view photos.',
    placement: 'top',
  },
]

const GREETING_LABELS = {
  morning: 'Good Morning',
  afternoon: 'Good Afternoon',
  evening: 'Good Evening',
  night: 'Good Night',
}

function useGreeting() {
  return useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Good Morning'
    if (hour < 15) return 'Good Afternoon'
    if (hour < 18) return 'Good Evening'
    return 'Good Night'
  }, [])
}

// Map the backend greeting time (computed in the server timezone) to a label
function greetingFromTime(time) {
  return GREETING_LABELS[time] || ''
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function formatFullDate(timestamp) {
  const date = new Date(timestamp)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function formatNow(date) {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function Main() {
  const navigate = useNavigate()
  const [greeting, setGreeting] = useState(useGreeting())
  const [sheetOpen, setSheetOpen] = useState(false)

  const [now, setNow] = useState(new Date())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [todayStatus, setTodayStatus] = useState(null)
  const [absenceList, setAbsenceList] = useState([])

  useEffect(() => {
    let isInitialLoad = true
    
    async function fetchHomeData() {
      try {
        // Only show loading skeleton on initial load
        if (isInitialLoad) {
          setLoading(true)
        }
        
        const response = await getUserHome()
        const data = response?.data || response
        
        // Set user name and greeting from the backend (timezone-aware)
        if (data.greeting_widget) {
          setUserName(data.greeting_widget.name || '')
          const backendGreeting = greetingFromTime(data.greeting_widget.time)
          if (backendGreeting) {
            setGreeting(backendGreeting)
          }
        }
        
        // Map today's attendance from API
        // Only show as "present" if type is "attendance", not "absence"
        if (data.today && data.today.type === 'attendance') {
          const timestamp = data.today.timestamp
          const displayAddress = data.today.display_address
          setTodayStatus({
            date: formatDate(timestamp),
            status: 'present',
            title: `Present on ${formatFullDate(timestamp)}`,
            subtitle: displayAddress
              ? `Location on ${displayAddress}`
              : 'Location on Yogyakarta, Sleman',
          })
        } else {
          setTodayStatus(null)
        }
        
        // Map absence history from API (max 3 items)
        if (data.absence && Array.isArray(data.absence)) {
          const mappedAbsences = data.absence.slice(0, 3).map((item) => {
            // Determine status based on verify info
            let status = 'pending'
            let subtitle = 'Submitting an absence request'
            
            if (item.verify && item.verify.sign_status) {
              const signStatus = item.verify.sign_status.toLowerCase()
              const verifierName = item.verify.username || 'Admin'
              
              if (signStatus === 'allow') {
                status = 'approved'
                subtitle = `${item.option === 'sick' ? 'S' : 'I'} • Verified by ${verifierName}`
              } else if (signStatus === 'reject' || signStatus === 'rejected') {
                status = 'rejected'
                subtitle = `${item.option === 'sick' ? 'S' : 'I'} • Verified by ${verifierName}`
              }
            }
            
            // Use reason as title
            const title = item.reason || (item.option === 'sick' ? 'Leave because sick' : 'Leave')
            
            return {
              id: item.id || Math.random().toString(),
              date: '03/07', // TODO: Get from actual timestamp when available
              status: status,
              title: title,
              subtitle: subtitle,
            }
          })
          
          setAbsenceList(mappedAbsences)
        } else {
          setAbsenceList([])
        }
        
        // Mark as no longer initial load after first success
        if (isInitialLoad) {
          isInitialLoad = false
          setLoading(false)
        }
      } catch (err) {
        // Only show error toast on initial load, silent fail on polling
        if (isInitialLoad) {
          toast.error(err.message || 'Failed to load home data')
          console.error('getUserHome error:', err)
          setLoading(false)
        }
      }
    }

    // Initial fetch
    fetchHomeData()
    
    // Set up polling interval - refresh every 10 seconds
    const intervalId = setInterval(() => {
      fetchHomeData()
    }, 10000)
    
    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // Realtime clock for the header
  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  function handleLogoutClick() {
    setConfirmOpen(true)
  }

  async function handleConfirmLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  function handlePickAttendance() {
    setSheetOpen(false)
    navigate('/attendance')
  }

  function handlePickPhotos() {
    setSheetOpen(false)
    navigate('/photos')
  }

  function handlePickAbsence() {
    setSheetOpen(false)
    navigate('/absence')
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-6">
        <div className="animate-pulse">
          <div className="py-4 pt-8">
            <div className="h-8 w-64 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
          
          <section className="mt-6">
            <div className="mb-2 h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-20 w-full rounded-xl bg-neutral-200 dark:bg-neutral-700" />
          </section>

          <section className="mt-6">
            <div className="mb-2 h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex flex-col gap-2">
              <div className="h-20 w-full rounded-xl bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-20 w-full rounded-xl bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-6">
      <header data-guide="greeting" className="flex items-start justify-between gap-4 py-4 pt-8">
        <div>
          <h1 className="text-xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
            {greeting}, {userName} <span aria-hidden>👋</span>
          </h1>
          <small className="mt-1 block text-xs text-neutral dark:text-neutral-400">{formatNow(now)}</small>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle className="h-9 w-9 rounded-full" />
          <button
            type="button"
            onClick={handleLogoutClick}
            aria-label="Logout"
            title="Logout"
            className="flex cursor-pointer h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger transition hover:bg-danger/10 active:scale-[0.96]"
          >
            <Icon data={ArrowRightFromSquare} size={18} />
          </button>
        </div>
      </header>

      <section data-guide="today-status" className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-neutral dark:text-neutral-400">Today</h2>
        {todayStatus ? (
          <AbsenceCard {...todayStatus} />
        ) : (
          <div className="flex items-center justify-center rounded-xl bg-neutral-100 p-8 dark:bg-neutral-800/60">
            <p className="text-sm text-neutral dark:text-neutral-400">No attendance status yet</p>
          </div>
        )}
      </section>

      <section data-guide="absence-list" className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-neutral dark:text-neutral-400">Absence</h2>
        {absenceList.length > 0 ? (
          <div className="flex flex-col gap-2">
            {absenceList.map((item) => (
              <AbsenceCard key={item.id} {...item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl bg-neutral-100 p-8 dark:bg-neutral-800/60">
            <p className="text-sm text-neutral dark:text-neutral-400">There is no absence list</p>
          </div>
        )}
      </section>

      <button
        data-guide="attendance-button"
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-fit cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition active:scale-[0.97]"
      >
        <Icon data={Paperclip} size={16} />
        Attendance
      </button>

      <AttendanceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onPickAttendance={handlePickAttendance}
        onPickAbsence={handlePickAbsence}
        onPickPhotos={handlePickPhotos}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Are you sure you want to log out?"
        description="Your session will be ended and you'll return to the login page."
        confirmLabel="Logout"
        cancelLabel="Cancel"
        danger
        onConfirm={handleConfirmLogout}
      />

      {!isPageTipDone('main') && (
        <PageGuideOverlay page="main" steps={MAIN_STEPS} />
      )}
    </main>
  )
}