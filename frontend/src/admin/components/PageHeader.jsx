/**
 * Consistent page header: title + small description, with an optional slot
 * for page-level actions (right side) and extra content below the
 * description (e.g. inline notices).
 */
export default function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h1>
        {description && <p className="max-w-2xl text-xs text-neutral dark:text-neutral-400">{description}</p>}
        {children}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
