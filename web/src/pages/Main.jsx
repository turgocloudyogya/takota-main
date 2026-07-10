import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@gravity-ui/uikit'
import { Clock } from '@gravity-ui/icons'
import {
  currentUser,
  initialTodayStatus,
  initialHistoryList,
} from '../lib/mockData.js'
import AbsenceRow from '../components/AbsenceRow.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AttendanceSheet from '../components/AttendanceSheet.jsx'

function useGreeting() {
  return useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Good Morning'
    if (hour < 15) return 'Good Afternoon'
    if (hour < 18) return 'Good Evening'
    return 'Good Night'
  }, [])
}

export default function Main() {
  const navigate = useNavigate()
  const greeting = useGreeting()
  const [sheetOpen, setSheetOpen] = useState(false)

  // "Today" is a single status card driven by the same 4-color system
  // (approved / pending / rejected / alpha) used across the app.
  // NOTE: Attendance and Absence are now their own pages (/attendance,
  // /absence) and don't share state with Main, so nothing currently
  // updates todayStatus/historyList after a submission completes —
  // wire that up (e.g. via context or persisted storage) once those
  // pages need to reflect back here.
  const [todayStatus] = useState(initialTodayStatus)

  // "Absence" is a history of status: every izin/absence request the
  // user has submitted, newest first.
  const [historyList] = useState(initialHistoryList)

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 pb-28 pt-8">
      <h1 className="text-xl font-bold text-neutral-900">
        {greeting}, {currentUser.name} <span aria-hidden>👋</span>
      </h1>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-neutral">Today</h2>
        {todayStatus ? (
          <AbsenceRow
            date={todayStatus.date}
            status={todayStatus.status}
            title={todayStatus.title}
            subtitle={todayStatus.subtitle}
          />
        ) : (
          <EmptyState label="No attendance status yet" />
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-neutral">Absence</h2>
        {historyList.length > 0 ? (
          <div className="flex flex-col gap-2">
            {historyList.map((item) => (
              <AbsenceRow key={item.id} {...item} />
            ))}
          </div>
        ) : (
          <EmptyState label="There is no absence list" />
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