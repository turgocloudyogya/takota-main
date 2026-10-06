// Shared loading skeletons for admin pages: labels and headings stay real,
// only the not-yet-fetched values pulse.
export function ValueSkeleton({ className = 'h-7 w-20' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className}`} />
}

export function MetricSkeleton({ label }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-2">
        <ValueSkeleton />
      </div>
    </div>
  )
}

export function RowSkeleton({ rows = 4, className = 'h-20' }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700 ${className}`} />
      ))}
    </div>
  )
}

export function PanelSkeleton({ className = 'h-40' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700 ${className}`} />
}
