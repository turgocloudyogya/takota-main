import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Clock } from '@gravity-ui/icons'
import { getUserHome } from '../lib/api.js'
import AbsenceCard from '../components/AbsenceCard.jsx'
import AttendanceSheet from '../components/AttendanceSheet.jsx'

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

export default function Main() {
  const navigate = useNavigate()
  const [greeting, setGreeting] = useState(useGreeting())
  const [sheetOpen, setSheetOpen] = useState(false)

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
            const title = item.reason || (item.option === 'sick' ? 'Izin karena sakit' : 'Izin')
            
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
      <main className="mx-auto min-h-screen w-full max-w-md px-5 pb-28 pt-20">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded bg-neutral-200" />
          
          <section className="mt-6">
            <div className="mb-2 h-4 w-16 rounded bg-neutral-200" />
            <div className="h-20 w-full rounded-xl bg-neutral-200" />
          </section>

          <section className="mt-6">
            <div className="mb-2 h-4 w-20 rounded bg-neutral-200" />
            <div className="flex flex-col gap-2">
              <div className="h-20 w-full rounded-xl bg-neutral-200" />
              <div className="h-20 w-full rounded-xl bg-neutral-200" />
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 pb-28 pt-20">
      <h1 className="text-xl font-bold text-neutral-900">
        {greeting}, {userName} <span aria-hidden>👋</span>
      </h1>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-neutral">Today</h2>
        {todayStatus ? (
          <AbsenceCard {...todayStatus} />
        ) : (
          <div className="flex items-center justify-center rounded-xl bg-neutral-100 p-8">
            <p className="text-sm text-neutral">No attendance status yet</p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-neutral">Absence</h2>
        {absenceList.length > 0 ? (
          <div className="flex flex-col gap-2">
            {absenceList.map((item) => (
              <AbsenceCard key={item.id} {...item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl bg-neutral-100 p-8">
            <p className="text-sm text-neutral">There is no absence list</p>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition active:scale-[0.97]"
      >
        <Icon data={Clock} size={16} />
        Attendance
      </button>

      <AttendanceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onPickAttendance={handlePickAttendance}
        onPickAbsence={handlePickAbsence}
        onPickPhotos={handlePickPhotos}
      />
    </main>
  )
}