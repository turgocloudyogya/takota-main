// Status keys map 1:1 to the 4 brand colors defined in src/index.css.
// This single mapping drives BOTH the "Today" status card and every row
// in the "Absence" history list, so a status always looks the same
// wherever it's shown.
//
// approved -> success (#00BC7D)  e.g. present today / izin diterima
// pending  -> warning (#F0B409)  e.g. izin awaiting verification
// rejected -> danger  (#FB2C36)  e.g. izin ditolak
// alpha    -> neutral (#737373)  e.g. absent, marked by the system

export const currentUser = {
  name: 'Ahnaf',
}

export const statusBadgeStyles = {
  approved: 'bg-success',
  pending: 'bg-warning',
  rejected: 'bg-danger',
  alpha: 'bg-neutral',
}

export const statusLabels = {
  approved: 'Izin (Telah Diterima)',
  pending: 'Izin (Pending)',
  rejected: 'Izin (Ditolak)',
  alpha: 'Alpha',
}

// "Today" starts empty until the user takes an action from the
// Attendance / Absence sheet. Main.jsx owns the live value; this is
// just the initial/default state ("No attendance status yet").
export const initialTodayStatus = null

// "Absence" is a history of status — every izin/absence request the
// user has ever submitted, oldest action last. New submissions are
// prepended to this list at runtime (see Main.jsx).
// Photos captured when attendance/absence is recorded via photo
// ("Foto Absen"). Backs the /photos gallery page — newest first.
// Set to [] to see the "No photo list" empty state.
export const initialPhotoList = [
  { id: 'ph-1', url: 'https://picsum.photos/seed/takota-1/500', date: '07/07/2026', time: '07:58', username: 'Ahnaffarras' },
  { id: 'ph-2', url: 'https://picsum.photos/seed/takota-2/500', date: '06/07/2026', time: '08:02', username: 'RafiFadhilah' },
  { id: 'ph-3', url: 'https://picsum.photos/seed/takota-3/500', date: '06/07/2026', time: '07:49', username: 'Ahnaffarras' },
  { id: 'ph-4', url: 'https://picsum.photos/seed/takota-4/500', date: '05/07/2026', time: '08:10', username: 'WirawanY' },
  { id: 'ph-5', url: 'https://picsum.photos/seed/takota-5/500', date: '05/07/2026', time: '07:55', username: 'RafiFadhilah' },
  { id: 'ph-6', url: 'https://picsum.photos/seed/takota-6/500', date: '04/07/2026', time: '08:00', username: 'Ahnaffarras' },
  { id: 'ph-7', url: 'https://picsum.photos/seed/takota-7/500', date: '03/07/2026', time: '07:52', username: 'WirawanY' },
  { id: 'ph-8', url: 'https://picsum.photos/seed/takota-8/500', date: '03/07/2026', time: '07:12', username: 'Ahnaffarras' },
  { id: 'ph-9', url: 'https://picsum.photos/seed/takota-9/500', date: '02/07/2026', time: '08:05', username: 'RafiFadhilah' },
]

export const initialHistoryList = [
  {
    id: 'ab-1',
    date: '03/07',
    status: 'approved',
    title: 'Izin karena sedang sakit',
    subtitle: 'Verified by Wirawan Yogiyanto',
  },
  {
    id: 'ab-2',
    date: '02/07',
    status: 'rejected',
    title: 'Izin sedang ada acara',
    subtitle: 'Verified by Wirawan Yogiyanto',
  },
  {
    id: 'ab-3',
    date: '02/07',
    status: 'pending',
    title: 'Izin sedang ada acara keluarga',
    subtitle: 'Submitting an absence request',
  },
  {
    id: 'ab-4',
    date: '01/07',
    status: 'alpha',
    title: 'Absent on 01/07/2026',
    subtitle: 'By system',
  },
]