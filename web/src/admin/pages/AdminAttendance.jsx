import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { TrashBin, MapPin, Camera, Clock } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeAttendance } from '../lib/normalize.js'
import { parseApiDate } from '../lib/dateWindow.js'
import { Toolbar, PagerFooter } from '../components/ListChrome.jsx'
import { ConfirmDialog } from '../components/Modals.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'

const LIMIT = 15

function formatDateTime(dateRaw) {
  const d = parseApiDate(dateRaw)
  if (!d) return dateRaw || '—'
  return d.toLocaleString('id-ID', {
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
        toast.error(err.message || 'Gagal memuat data presensi.')
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
        if (!cancelled) toast.error(err.message || 'Gagal memuat data presensi.')
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
      toast.success('Data presensi berhasil dihapus.')
      setDeleteTarget(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus data presensi.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Clock}
        eyebrow="Riwayat Kehadiran"
        title="Presensi"
        description="Riwayat check-in kehadiran siswa beserta lokasi dan foto absen."
      />

      <Toolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={handleRefresh}
        placeholder="Cari nama atau username…"
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-app-border/15 bg-neutral-50 text-xs font-medium text-neutral">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral">
                    Memuat data…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState label="Belum ada data presensi" />
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{row.name || '—'}</p>
                      {row.username && <p className="text-xs text-neutral">{row.username}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{formatDateTime(row.dateRaw)}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {row.location ? (
                        <span className="inline-flex items-center gap-1">
                          <Icon data={MapPin} size={13} className="text-neutral" />
                          {row.location}
                        </span>
                      ) : row.latitude && row.longitude ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Icon data={MapPin} size={13} className="text-neutral" />
                          {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.photoUrl ? (
                        <a
                          href={row.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-neutral-100"
                        >
                          <img src={row.photoUrl} alt="Foto absen" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral">
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
                          aria-label="Hapus"
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
            countLabel={`Halaman ${pageIndex + 1} · ${items.length} data ditampilkan`}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus data presensi?"
        description="Data presensi ini akan dihapus permanen dan tidak dapat dikembalikan."
        confirmLabel="Hapus"
        danger
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
