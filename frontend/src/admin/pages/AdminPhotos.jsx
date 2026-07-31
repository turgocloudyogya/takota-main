import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Picture, TrashBin } from '@gravity-ui/icons'
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
  const [deleting, setDeleting] = useState(null)

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
          date: photo.created_at || '',
          nickname: photo.nickname || 'Siswa',
          username: photo.nickname || 'Siswa', // For modal compatibility
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
      toast.error(err.message || 'Gagal memuat galeri foto.')
      console.error('listPhotos error:', err)
    } finally {
      if (isLoadingMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  async function handleDelete(photoId, e) {
    e.stopPropagation()
    
    if (!confirm('Hapus foto ini?')) return

    setDeleting(photoId)
    try {
      await api.deletePhoto(photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      toast.success('Foto berhasil dihapus')
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus foto')
    } finally {
      setDeleting(null)
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
        eyebrow="Galeri"
        title="Foto Presensi"
        description="Galeri foto yang diupload siswa saat melakukan presensi dengan foto. Klik untuk preview, atau klik tombol hapus untuk menghapus foto."
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-neutral-200" />
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
                <div key={i} className="aspect-square bg-neutral-200" />
              ))}
            </div>
            {/* Fade gradient */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-[70%] to-neutral-50" />
          </div>

          {/* Empty message */}
          <div className="relative z-10 -mt-20 flex flex-col items-center px-4 pb-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-neutral-200 text-neutral-900">
              <Icon data={Picture} size={28} />
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Belum ada foto</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
              Galeri akan terisi ketika siswa melakukan presensi dengan foto. Semua foto akan tersedia di sini.
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
                className="group relative aspect-square overflow-hidden bg-neutral-100"
              >
                <img 
                  src={photo.url} 
                  alt={`Foto ${photo.nickname}`} 
                  className="h-full w-full object-cover" 
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent p-2 opacity-0 transition duration-150 group-hover:opacity-100">
                  <div className="flex w-full items-center justify-between">
                    <p className="truncate text-[11px] font-medium text-white">
                      {photo.date ? new Date(photo.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      }) : ''} • {photo.nickname}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(photo.id, e)}
                      disabled={deleting === photo.id}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger/90 text-white transition hover:bg-danger disabled:opacity-50"
                      aria-label="Hapus foto"
                    >
                      <Icon data={TrashBin} size={14} />
                    </button>
                  </div>
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
                {loadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}

      <PhotoPreviewModal photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </div>
  )
}
