import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { ChevronLeft } from '@gravity-ui/icons'
import { getPhotos } from '../lib/api.js'
import PhotoPreviewModal from '../components/PhotoPreviewModal.jsx'
import PhotoGalleryEmptyState from '../components/PhotoGalleryEmptyState.jsx'

// Gallery of every photo uploaded while recording attendance/absence
// via photo. Mobile layout (3 columns) matches the design 1:1; on
// wider viewports the container and grid widen so the same page
// doesn't look stretched/sparse on desktop.
export default function Photos() {
  const navigate = useNavigate()
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
            date: photo.created_at || '',
            username: photo.nickname || 'Siswa',
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
          date: photo.created_at || '',
          username: photo.nickname || 'Siswa',
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

      {loading ? (
        <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-neutral-200" />
          ))}
        </div>
      ) : photoList.length > 0 ? (
        <>
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
                    {photo.date ? new Date(photo.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }) : ''} • {photo.username}
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
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      ) : (
        <PhotoGalleryEmptyState />
      )}

      <PhotoPreviewModal photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </main>
  )
}