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
