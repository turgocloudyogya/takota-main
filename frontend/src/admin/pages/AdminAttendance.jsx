import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { TrashBin, MapPin, Camera, Clock } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeAttendance } from '../lib/normalize.js'
import { parseApiDate } from '../lib/dateWindow.js'
import { Toolbar, PagerFooter } from '../components/ListChrome.jsx'
import { ConfirmDialog } from '../../components/Modals.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PhotoPreviewModal from '../../components/PhotoPreviewModal.jsx'

const LIMIT = 15

function formatDate(dateRaw) {
  const d = parseApiDate(dateRaw)
  if (!d) return dateRaw || '-'
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(dateRaw) {
  const d = parseApiDate(dateRaw)
  if (!d) return ''
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(dateRaw) {
  const d = parseApiDate(dateRaw)
  if (!d) return dateRaw || '-'
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminAttendance() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageIndex, setPageIndex] = useState(0)
  const [lastIds, setLastIds] = useState([''])
  const [hasNext, setHasNext] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [activePhoto, setActivePhoto] = useState(null)

  // Use refs to store latest values for polling
  const pageIndexRef = useRef(pageIndex)
  const lastIdsRef = useRef(lastIds)
  const searchRef = useRef(search)

  // Update refs when state changes
  useEffect(() => {
    pageIndexRef.current = pageIndex
  }, [pageIndex])

  useEffect(() => {
    lastIdsRef.current = lastIds
  }, [lastIds])

  useEffect(() => {
    searchRef.current = search
  }, [search])

  const loadPage = useCallback(async (index, cursors, term, isPolling = false) => {
    // Only show loading spinner if not polling
    if (!isPolling) {
      setLoading(true)
    }
    try {
      const json = await api.listAttendance({ limit: LIMIT, lastId: cursors[index] || '', search: term })
      const rawList = unwrapList(json, 'attendances')
      const normalized = rawList.map(normalizeAttendance).filter(Boolean)
      setItems(normalized)
      setHasNext(normalized.length === LIMIT)
      if (normalized.length > 0) {
        const nextCursor = normalized[normalized.length - 1].id
        setLastIds((prev) => {
          const copy = [...prev]
          copy[index + 1] = nextCursor
          return copy
        })
      }
    } catch (err) {
      // Only show error toast if not polling
      if (!isPolling) {
        toast.error(err.message || 'Failed to load attendance data.')
      }
    } finally {
      if (!isPolling) {
        setLoading(false)
      }
    }
  }, [])

  // Initial data load only
  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const json = await api.listAttendance({ limit: LIMIT, lastId: '', search: '' })
        const rawList = unwrapList(json, 'attendances')
        const normalized = rawList.map(normalizeAttendance).filter(Boolean)
        if (cancelled) return
        setItems(normalized)
        setHasNext(normalized.length === LIMIT)
        if (normalized.length > 0) {
          const nextCursor = normalized[normalized.length - 1].id
          setLastIds((prev) => {
            const copy = [...prev]
            copy[1] = nextCursor
            return copy
          })
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load attendance data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  // Polling interval - uses refs to get latest values without re-creating interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Use refs to get current values without triggering effect dependencies
      loadPage(pageIndexRef.current, lastIdsRef.current, searchRef.current, true)
    }, 15000)
    
    return () => {
      clearInterval(intervalId)
    }
  }, [loadPage]) // Only re-create interval if loadPage changes

  function handleSearchSubmit() {
    setSearch(searchInput)
    setPageIndex(0)
    setLastIds([''])
    loadPage(0, [''], searchInput)
  }

  function handleRefresh() {
    loadPage(pageIndex, lastIds, search)
  }

  function handleNext() {
    const nextIndex = pageIndex + 1
    setPageIndex(nextIndex)
    loadPage(nextIndex, lastIds, search)
  }

  function handlePrev() {
    const prevIndex = Math.max(0, pageIndex - 1)
    setPageIndex(prevIndex)
    loadPage(prevIndex, lastIds, search)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteAttendance(deleteTarget.id)
      toast.success('Attendance record deleted successfully.')
      setDeleteTarget(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to delete attendance record.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Clock}
        eyebrow="Attendance History"
        title="Attendance"
        description="Students' attendance check-in history with location and attendance photo."
      />

      <Toolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={handleRefresh}
        placeholder="Search name or username…"
      />

      <div data-guide="attendance-table" className="flex flex-col gap-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-neutral dark:text-neutral-400">
            Loading data…
          </p>
        ) : items.length === 0 ? (
          <div className="py-8">
            <EmptyState label="No attendance data yet" />
          </div>
        ) : (
          items.map((row) => {
            const mapSrc =
              row.latitude && row.longitude
                ? `https://maps.google.com/maps?q=${encodeURIComponent(row.latitude)},${encodeURIComponent(row.longitude)}&z=15&output=embed`
                : null
            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row dark:border-neutral-700 dark:bg-neutral-900"
              >
                {mapSrc ? (
                  <iframe
                    title={`Map for ${row.name || row.username || 'attendance'}`}
                    src={mapSrc}
                    loading="lazy"
                    className="h-36 w-full shrink-0 rounded-lg border-0 bg-neutral-100 sm:h-auto sm:min-h-36 sm:w-48 dark:bg-neutral-800"
                  />
                ) : (
                  <div className="flex h-36 w-full shrink-0 items-center justify-center rounded-lg bg-neutral-100 sm:w-48 dark:bg-neutral-800">
                    <Icon data={MapPin} size={20} className="text-neutral dark:text-neutral-400" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 gap-3">
                  {row.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setActivePhoto({ url: row.photoUrl, date: row.dateRaw, username: row.username, displayAddress: row.displayAddress, latitude: row.latitude, longitude: row.longitude })}
                      className="h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800"
                    >
                      <img src={row.photoUrl} alt="Attendance photo" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral dark:bg-neutral-800 dark:text-neutral-400">
                      <Icon data={Camera} size={18} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{row.name || '-'}</p>
                    {row.username && <p className="truncate text-xs text-neutral dark:text-neutral-400">@{row.username}</p>}
                    <p className="mt-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                      {formatDate(row.dateRaw)}
                      {formatTime(row.dateRaw) ? ` · ${formatTime(row.dateRaw)}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral dark:text-neutral-400" title={row.displayAddress || row.location || ''}>
                      {row.displayAddress || row.location || (row.latitude && row.longitude ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}` : '-')}
                    </p>
                    {row.mapsUrl && (
                      <a
                        href={row.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Icon data={MapPin} size={12} />
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      onPress={() => setDeleteTarget(row)}
                      aria-label="Delete"
                      className="text-danger"
                    >
                      <Icon data={TrashBin} size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <PagerFooter
        pageIndex={pageIndex}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
        loading={loading}
        countLabel={`Page ${pageIndex + 1} · ${items.length} records shown`}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete attendance record?"
        description="This attendance record will be permanently deleted and cannot be restored."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
      />

      <PhotoPreviewModal photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </div>
  )
}
