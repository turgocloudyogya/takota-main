// AbsenceCard - Component for displaying attendance/absence status
// Supports 4 variants: approved (green), rejected (red), pending (yellow), alpha (gray)

const statusBadgeStyles = {
  approved: 'bg-success',
  pending: 'bg-warning',
  rejected: 'bg-danger',
  alpha: 'bg-neutral',
  present: 'bg-success', // present is the same as approved (green)
}

export default function AbsenceCard({ date, status, title, subtitle }) {
  const colorClass = statusBadgeStyles[status] || statusBadgeStyles.alpha

  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60">
      <span className={`flex h-13 w-15 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${colorClass}`}>
        {date}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
        <p className="truncate text-xs text-neutral dark:text-neutral-400">{subtitle}</p>
      </div>
    </div>
  )
}
