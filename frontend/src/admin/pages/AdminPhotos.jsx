import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Picture } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import PageHeader from '../components/PageHeader.jsx'
import PhotoPreviewModal from '../../components/PhotoPreviewModal.jsx'

const FETCH_LIMIT = 50

export default function AdminPhotos() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [activePhoto, setActivePhoto] = useState(null)

  useEffect(() => {
    loadPhotos()
  }, [])

  async function loadPhotos(lastId = '') {
    const isLoadingMore = Boolean(lastId)
    if (isLoadingMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const data = await api.listPhotos({ limit: FETCH_LIMIT, lastId })
      
      if (data && data.data && Array.isArray(data.data)) {
        // Map API response to component format
        const mappedPhotos = data.data.map((photo) => ({
          id: photo.id,
          url: photo.url,
          date: photo.timestamp || photo.created_at || '',
          nickname: photo.user?.name || 'Student',
          username: photo.user?.username || 'Student', // For modal compatibility
        }))
        
        if (isLoadingMore) {
          setPhotos((prev) => [...prev, ...mappedPhotos])
        } else {
          setPhotos(mappedPhotos)
        }
        
        setHasMore(Boolean(data.last_id))
      } else {
        if (!isLoadingMore) setPhotos([])
        setHasMore(false)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load the photo gallery.')
      console.error('listPhotos error:', err)
    } finally {
      if (isLoadingMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore || photos.length === 0) return
    const lastId = photos[photos.length - 1].id
    loadPhotos(lastId)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Picture}
        eyebrow="Gallery"
        title="Attendance Photos"
        description="Gallery of photos uploaded by students when checking in with a photo. Click to preview. Photos are deleted automatically when the attendance record is deleted."
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-neutral-200 dark:bg-neutral-700" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center">
          {/* Placeholder grid - same layout as photo grid */}
          <div
            className="relative w-full overflow-hidden"
            style={{ maxHeight: '320px' }}
            aria-hidden="true"
          >
            <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 45 }).map((_, i) => (
                <div key={i} className="aspect-square bg-neutral-200 dark:bg-neutral-800" />
              ))}
            </div>
            {/* Fade gradient */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-neutral-50 dark:to-[#0a0a0a]" />
          </div>

          {/* Empty message */}
          <div className="relative z-10 -mt-20 flex flex-col items-center px-4 pb-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
              <Icon data={Picture} size={28} />
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">No photos yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              The gallery fills up when students check in with a photo. All photos will be available here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActivePhoto(photo)}
                className="group relative aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-800"
              >
                <img 
                  src={photo.url} 
                  alt={`Photo of ${photo.nickname}`} 
                  className="h-full w-full object-cover" 
                />
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
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      <PhotoPreviewModal photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </div>
  )
}
