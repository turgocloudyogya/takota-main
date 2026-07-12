import React from 'react';
import { Icon } from '@gravity-ui/uikit';
import { PaperPlane } from '@gravity-ui/icons';

export default function PhotoGalleryEmptyState({
  headerTitle = 'Photos',
  title = 'No photo list',
  description = 'The gallery will be available if attendance is recorded via photo, all photos will be available here',
  onBack,
  className = '',
}) {
  // Match the actual photo grid: 3 cols mobile, 4 cols tablet, 5 cols desktop
  // Calculate enough items for ~9 rows at maximum (desktop 5 cols)
  const GRID_CELL_COUNT = 45; // 9 rows x 5 cols

  return (
    <div className={`flex min-h-screen w-full flex-col bg-white ${className}`}>
      {/* Empty state body */}
      <div className="flex flex-1 flex-col items-center px-4 pt-2 sm:px-6 lg:px-8">
        {/* Placeholder grid — matches actual photo grid layout exactly */}
        <div
          className="relative w-full overflow-hidden"
          style={{ maxHeight: '320px' }}
          aria-hidden="true"
        >
          <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: GRID_CELL_COUNT }).map((_, i) => (
              <div key={i} className="aspect-square bg-neutral-200" />
            ))}
          </div>
          {/* Fade gradient to blend into white background */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-[70%] to-white" />
        </div>

        {/* Icon badge, message and description */}
        <div className="relative z-10 -mt-20 flex flex-col items-center px-4 pb-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-neutral-200 text-neutral-900">
            <Icon data={PaperPlane} size={28} />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}