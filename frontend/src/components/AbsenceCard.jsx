// AbsenceCard - Component for displaying attendance/absence status
// Supports 4 variants: approved (green), rejected (red), pending (yellow), alpha (gray)
// When `onDelete` is provided, a delete button appears on the right side.

import { Icon } from '@gravity-ui/uikit'
import { TrashBin } from '@gravity-ui/icons'

const statusBadgeStyles = {
  approved: 'bg-success',
  pending: 'bg-warning',
  rejected: 'bg-danger',
  alpha: 'bg-neutral',
  present: 'bg-success', // present is the same as approved (green)
}

export default function AbsenceCard({ date, status, title, subtitle, onDelete }) {
  const colorClass = statusBadgeStyles[status] || statusBadgeStyles.alpha

  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-100 pr-3 dark:bg-neutral-800/60">
      <span className={`flex h-13 w-15 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${colorClass}`}>
        {date}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
        <p className="truncate text-xs text-neutral dark:text-neutral-400">{subtitle}</p>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete absence"
          title="Delete absence"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-danger transition hover:bg-danger/10 active:scale-[0.96]"
        >
          <Icon data={TrashBin} size={16} />
        </button>
      )}
    </div>
  )
}
