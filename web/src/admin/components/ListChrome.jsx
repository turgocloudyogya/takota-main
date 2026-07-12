import { Icon } from '@gravity-ui/uikit'
import { Magnifier, ArrowLeft, ArrowRight, ArrowsRotateLeft } from '@gravity-ui/icons'
import { Button } from '@heroui/react'

export function Toolbar({ search, onSearchChange, onSearchSubmit, onRefresh, actions, placeholder = 'Cari nama atau username…' }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSearchSubmit?.()
        }}
        className="flex w-full items-center gap-2 rounded-xl border border-transparent bg-neutral-100 px-3.5 py-2.5 transition focus-within:border-primary/30 focus-within:bg-white focus-within:shadow-sm sm:max-w-xs"
      >
        <Icon data={Magnifier} size={16} className="shrink-0 text-neutral" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
        />
      </form>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button variant="outline" size="sm" isIconOnly onPress={onRefresh} aria-label="Muat ulang">
            <Icon data={ArrowsRotateLeft} size={15} />
          </Button>
        )}
        {actions}
      </div>
    </div>
  )
}

export function PagerFooter({ pageIndex, hasNext, onPrev, onNext, loading, countLabel }) {
  return (
    <div className="flex items-center justify-between border-t border-app-border/15 pt-3">
      <p className="text-xs text-neutral">{countLabel}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={onPrev}
          isDisabled={pageIndex === 0 || loading}
        >
          <Icon data={ArrowLeft} size={14} />
          Sebelumnya
        </Button>
        <Button variant="outline" size="sm" onPress={onNext} isDisabled={!hasNext || loading}>
          Berikutnya
          <Icon data={ArrowRight} size={14} />
        </Button>
      </div>
    </div>
  )
}

// Sliding segmented switch for splitting a list by category (e.g. all /
// siswa / admin) without leaving the page or refetching — a client-side view
// filter over rows already loaded. The active pill glides between segments;
// each segment's active color can be tuned via `tone` to echo the meaning it
// carries elsewhere in the UI (e.g. TypeChip's accent color for "admin").
const FILTER_TONE_TEXT = {
  accent: 'text-primary',
  neutral: 'text-neutral-900',
}
const FILTER_TONE_BADGE = {
  accent: 'bg-primary/10 text-primary',
  neutral: 'bg-neutral-200/70 text-neutral-700',
}

export function SegmentedFilter({ options, value, onChange }) {
  const activeIndex = Math.max(0, options.findIndex((opt) => opt.key === value))

  return (
    <div className="inline-flex rounded-2xl bg-neutral-100 p-1">
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <span
          className="absolute inset-y-0 rounded-xl bg-white shadow-sm ring-1 ring-app-border/10 transition-transform duration-200 ease-out"
          style={{ width: `${100 / options.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden="true"
        />
        {options.map((opt) => {
          const active = opt.key === value
          const tone = opt.tone || 'neutral'
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
                active ? FILTER_TONE_TEXT[tone] : 'text-neutral hover:text-neutral-900'
              }`}
            >
              {opt.icon && <Icon data={opt.icon} size={14} />}
              {opt.label}
              {typeof opt.count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] leading-normal tabular-nums transition-colors duration-200 ${
                    active ? FILTER_TONE_BADGE[tone] : 'bg-neutral-200/60 text-neutral'
                  }`}
                >
                  {opt.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}