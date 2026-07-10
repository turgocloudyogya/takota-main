import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@gravity-ui/uikit'
import { ChevronLeft } from '@gravity-ui/icons'
import { initialPhotoList } from '../lib/mockData.js'
import PhotoPreviewModal from '../components/PhotoPreviewModal.jsx'
import PhotoGalleryEmptyState from '../components/PhotoGalleryEmptyState.jsx'

// Gallery of every photo uploaded while recording attendance/absence
// via photo. Mobile layout (3 columns) matches the design 1:1; on
// wider viewports the container and grid widen so the same page
// doesn't look stretched/sparse on desktop.
export default function Photos() {
  const navigate = useNavigate()
  const [photoList] = useState(initialPhotoList)
  const [activePhoto, setActivePhoto] = useState(null)

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 pb-10 pt-6 sm:max-w-2xl lg:max-w-4xl">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-neutral-900 transition active:scale-[0.94]"
        >
          <Icon data={ChevronLeft} size={20} />
        </button>
        <h1 className="text-base font-semibold text-neutral-900">Photos</h1>
      </header>

      {photoList.length > 0 ? (
        <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
          {photoList.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhoto(photo)}
              className="group relative aspect-square overflow-hidden bg-neutral-100"
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent p-2 opacity-0 transition duration-150 group-hover:opacity-100">
                <p className="truncate text-[11px] font-medium text-white">
                  {photo.date} • @{photo.username}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <PhotoGalleryEmptyState />
      )}

      <PhotoPreviewModal photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </main>
  )
}