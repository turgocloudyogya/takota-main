import { Icon } from '@gravity-ui/uikit';
import { PaperPlane } from '@gravity-ui/icons';

export default function PhotoGalleryEmptyState({
  title = 'No photo list',
  description = 'The gallery will be available if attendance is recorded via photo, all photos will be available here',
  className = '',
}) {
  // Match the actual photo grid (3 columns) so the placeholder keeps the
  // same size as the loading skeleton and the real photo list.
  const GRID_CELL_COUNT = 30; // 10 rows x 3 cols

  return (
    <div className={`flex w-full flex-col items-center ${className}`}>
      {/* Placeholder grid - matches actual photo grid layout exactly */}
      <div
        className="relative w-full overflow-hidden"
        style={{ maxHeight: '320px' }}
        aria-hidden="true"
      >
        <div className="grid grid-cols-3 gap-px">
          {Array.from({ length: GRID_CELL_COUNT }).map((_, i) => (
            <div key={i} className="aspect-square bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
        {/* Fade gradient to blend into page background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-[70%] to-white dark:to-[#0a0a0a]" />
      </div>

      {/* Icon badge, message and description */}
      <div className="relative z-10 -mt-20 flex flex-col items-center px-4 pb-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
          <Icon data={PaperPlane} size={28} />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      </div>
    </div>
  );
}
