// AbsenceCard - Komponen untuk menampilkan status attendance/absence
// Mendukung 4 varian: approved (hijau), rejected (merah), pending (kuning), alpha (abu-abu)

const statusBadgeStyles = {
  approved: 'bg-success',
  pending: 'bg-warning',
  rejected: 'bg-danger',
  alpha: 'bg-neutral',
  present: 'bg-success', // present sama dengan approved (hijau)
}

export default function AbsenceCard({ date, status, title, subtitle }) {
  const colorClass = statusBadgeStyles[status] || statusBadgeStyles.alpha

  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-100">
      <span className={`flex h-13 w-15 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${colorClass}`}>
        {date}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
        <p className="truncate text-xs text-neutral">{subtitle}</p>
      </div>
    </div>
  )
}
