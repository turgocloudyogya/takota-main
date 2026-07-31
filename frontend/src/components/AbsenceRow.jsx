import { statusBadgeStyles } from '../lib/mockData.js'

export default function AbsenceRow({ date, status, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-100">
      <span
        className={`flex h-13 w-15 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${statusBadgeStyles[status]}`}
      >
        {date}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
        <p className="truncate text-xs text-neutral">{subtitle}</p>
      </div>
    </div>
  )
}
