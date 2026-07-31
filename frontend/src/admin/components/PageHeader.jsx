import { Icon } from '@gravity-ui/uikit'

/**
 * Consistent page header: small icon badge + uppercase eyebrow + title +
 * description, with an optional slot for page-level actions (right side)
 * and extra content below the description (e.g. inline notices).
 */
export default function PageHeader({ icon, eyebrow, title, description, actions, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        {icon && (
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon data={icon} size={19} />
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          {eyebrow && (
            <span className="text-[11px] font-semibold tracking-[0.08em] text-primary/70 uppercase">{eyebrow}</span>
          )}
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-neutral">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
