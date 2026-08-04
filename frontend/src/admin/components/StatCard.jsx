import { Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'

const TONE_STYLES = {
  primary: { icon: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  success: { icon: 'bg-success/10 text-success', bar: 'bg-success' },
  warning: { icon: 'bg-warning/10 text-warning', bar: 'bg-warning' },
  danger: { icon: 'bg-danger/10 text-danger', bar: 'bg-danger' },
  neutral: { icon: 'bg-neutral/10 text-neutral', bar: 'bg-neutral' },
}

export default function StatCard({ label, value, icon, tone = 'primary', hint }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.primary
  return (
    <Card className="group relative overflow-hidden p-4 transition-shadow shadow-none dark:border-neutral-800">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${styles.bar} opacity-70`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral dark:text-neutral-400">{label}</p>
          <p className="mt-1.5 text-[1.65rem] leading-none font-bold tracking-tight text-neutral-900 tabular-nums dark:text-neutral-100">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-neutral dark:text-neutral-400">{hint}</p>}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon data={icon} size={18} />
        </span>
      </div>
    </Card>
  )
}
