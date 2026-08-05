import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
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

      <Card data-guide="attendance-table" className="overflow-hidden p-0 shadow-none dark:border-neutral-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-app-border/15 bg-neutral-50 text-xs font-medium text-neutral dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/10 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral dark:text-neutral-400">
                    Loading data…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState label="No attendance data yet" />
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{row.name || '-'}</p>
                      {row.username && <p className="text-xs text-neutral dark:text-neutral-400">{row.username}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{formatDateTime(row.dateRaw)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {row.displayAddress ? (
                            <span className="inline-flex items-center gap-1">
                              {row.displayAddress}
                            </span>
                          ) : row.location ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon data={MapPin} size={13} className="text-neutral dark:text-neutral-400" />
                              {row.location}
                            </span>
                          ) : row.latitude && row.longitude ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Icon data={MapPin} size={13} className="text-neutral dark:text-neutral-400" />
                              {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </span>
                        {row.mapsUrl && (
                          <a
                            href={row.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open location in Google Maps"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral hover:bg-primary/10 hover:text-primary dark:bg-neutral-800 dark:text-neutral-400"
                          >
                            <Icon data={MapPin} size={14} />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setActivePhoto({ url: row.photoUrl, date: row.dateRaw, username: row.username })}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800"
                        >
                          <img src={row.photoUrl} alt="Attendance photo" className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral dark:bg-neutral-800 dark:text-neutral-400">
                          <Icon data={Camera} size={14} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <PagerFooter
            pageIndex={pageIndex}
            hasNext={hasNext}
            onPrev={handlePrev}
            onNext={handleNext}
            loading={loading}
            countLabel={`Page ${pageIndex + 1} · ${items.length} records shown`}
          />
        </div>
      </Card>

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
