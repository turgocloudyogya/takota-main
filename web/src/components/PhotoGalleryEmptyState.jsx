import { Icon } from '@gravity-ui/uikit'
import { PaperPlane } from '@gravity-ui/icons'

// Matches the "No photo list" design: a faded 3x3 placeholder grid with
// a centered message on top, shown when attendance has never been
// recorded via photo yet.
export default function PhotoGalleryEmptyState() {
  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-app-border/10">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gradient-to-b from-neutral-100 to-neutral-200/60" />
        ))}
      </div>

      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center px-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 shadow-sm">
          <Icon data={PaperPlane} size={24} className="text-neutral-400" />
        </div>
        <h2 className="text-base font-bold text-neutral-900">No photo list</h2>
        <p className="mt-1.5 max-w-[260px] text-sm text-neutral">
          The gallery will be available if attendance is recorded via photo, all photos will be available here
        </p>
      </div>
    </div>
  )
}