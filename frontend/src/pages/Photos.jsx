import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getPhotos } from '../lib/api.js'
import BackButton from '../components/BackButton.jsx'
import PageGuideOverlay from '../components/PageGuideOverlay.jsx'
import PhotoPreviewModal from '../components/PhotoPreviewModal.jsx'
import PhotoGalleryEmptyState from '../components/PhotoGalleryEmptyState.jsx'
import { isPageTipDone } from '../lib/userGuide.js'

const PHOTOS_STEPS = [
  {
    target: '[data-guide="photo-gallery"]',
    title: 'Photo Gallery',
    description: 'Browse all attendance and absence photos submitted by you and other students. Tap any photo to view it full screen.',
    placement: 'bottom',
  },
]

// Gallery of every photo uploaded while recording attendance/absence
// via photo. Mobile layout (3 columns) matches the design 1:1; on
// wider viewports the container and grid widen so the same page
// doesn't look stretched/sparse on desktop.
export default function Photos() {
  const [loading, setLoading] = useState(true)
  const [photoList, setPhotoList] = useState([])
  const [activePhoto, setActivePhoto] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    async function fetchPhotos() {
      try {
        setLoading(true)
        const data = await getPhotos({ limit: 50 })
        
        if (data && data.data && Array.isArray(data.data)) {
          // Map API response to component format
          const mappedPhotos = data.data.map((photo) => ({
            id: photo.id,
            url: photo.url,
            date: photo.timestamp || photo.created_at || '',
            nickname: photo.user?.name || 'Student',
            username: photo.user?.username || 'Student',
          }))
          setPhotoList(mappedPhotos)
          setHasMore(Boolean(data.last_id))
        } else {
          setPhotoList([])
          setHasMore(false)
        }
      } catch (err) {
        toast.error(err.message || 'Failed to load photos')
        console.error('getPhotos error:', err)
        setPhotoList([])
      } finally {
        setLoading(false)
      }
    }

    fetchPhotos()
  }, [])

  async function loadMorePhotos() {
    if (loadingMore || !hasMore || photoList.length === 0) return

    try {
      setLoadingMore(true)
      const lastId = photoList[photoList.length - 1].id
      const data = await getPhotos({ limit: 50, lastId })
      
      if (data && data.data && Array.isArray(data.data)) {
        const mappedPhotos = data.data.map((photo) => ({
          id: photo.id,
          url: photo.url,
          date: photo.timestamp || photo.created_at || '',
          nickname: photo.user?.name || 'Student',
          username: photo.user?.username || 'Student',
        }))
        setPhotoList((prev) => [...prev, ...mappedPhotos])
        setHasMore(Boolean(data.last_id))
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load more photos')
      console.error('getPhotos pagination error:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md">
      <header className="flex h-[60px] w-full items-center justify-between gap-3 px-4">
        <BackButton label="Photos" />
        <span className="h-8 w-8 shrink-0" />
      </header>

      <div className="px-2">
        {loading ? (
          <div className="mt-2 grid grid-cols-3 gap-px">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse bg-neutral-200 dark:bg-neutral-700" />
            ))}
          </div>
        ) : photoList.length > 0 ? (
          <>
            <div data-guide="photo-gallery" className="mt-2 grid grid-cols-3 gap-px">
              {photoList.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setActivePhoto(photo)}
                  className="group relative cursor-pointer aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-800"
                >
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent p-2 opacity-0 transition duration-150 group-hover:opacity-100">
                    <p className="truncate text-[11px] font-medium text-white">
                      {photo.date ? (() => {
                        const d = new Date(photo.date)
                        const month = String(d.getMonth() + 1).padStart(2, '0')
                        const day = String(d.getDate()).padStart(2, '0')
                        const hours = String(d.getHours()).padStart(2, '0')
                        const minutes = String(d.getMinutes()).padStart(2, '0')
                        return `${day}/${month}/${d.getFullYear()} ${hours}:${minutes}`
                      })() : ''} • by {photo.nickname}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMorePhotos}
                  disabled={loadingMore}
                  className="cursor-pointer rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        ) : (
          <PhotoGalleryEmptyState className="mt-2" />
        )}
      </div>

      <PhotoPreviewModal photo={activePhoto} onClose={() => setActivePhoto(null)} />

      {!isPageTipDone('photos') && (
        <PageGuideOverlay page="photos" steps={PHOTOS_STEPS} />
      )}
    </main>
  )
}