import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { Check, Xmark, FileText, FileCheck, TrashBin } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeAbsence } from '../lib/normalize.js'
import { parseApiDate } from '../lib/dateWindow.js'
import { Toolbar, PagerFooter } from '../components/ListChrome.jsx'
import { OptionChip, SignChip } from '../components/StatusChip.jsx'
import { ConfirmDialog } from '../components/Modals.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'

const LIMIT = 15

function formatDate(dateRaw) {
  const d = parseApiDate(dateRaw)
  if (!d) return dateRaw || '—'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminAbsence() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageIndex, setPageIndex] = useState(0)
  const [lastIds, setLastIds] = useState([''])
  const [hasNext, setHasNext] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // { row, sign }
  const [pendingDelete, setPendingDelete] = useState(null) // { row }
  const [processing, setProcessing] = useState(false)

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
      const json = await api.listAbsence({ limit: LIMIT, lastId: cursors[index] || '', search: term })
      const rawList = unwrapList(json, 'absences')
      const normalized = rawList.map(normalizeAbsence).filter(Boolean)
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
        toast.error(err.message || 'Gagal memuat data izin.')
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
        const json = await api.listAbsence({ limit: LIMIT, lastId: '', search: '' })
        const rawList = unwrapList(json, 'absences')
        const normalized = rawList.map(normalizeAbsence).filter(Boolean)
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
        if (!cancelled) toast.error(err.message || 'Gagal memuat data izin.')
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

  async function handleConfirmAction() {
    if (!pendingAction) return
    setProcessing(true)
    try {
      await api.signAbsence(pendingAction.row.id, pendingAction.sign)
      toast.success(pendingAction.sign === 'allow' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.')
      setPendingAction(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui status pengajuan.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setProcessing(true)
    try {
      await api.deleteAbsence(pendingDelete.row.id)
      toast.success('Pengajuan izin berhasil dihapus.')
      setPendingDelete(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus pengajuan.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileCheck}
        eyebrow="Pengajuan"
        title="Izin & Sakit"
        description="Tinjau dan setujui/tolak pengajuan izin atau sakit dari siswa."
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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-app-border/15 bg-neutral-50 text-xs font-medium text-neutral">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral">
                    Memuat data…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState label="Belum ada pengajuan izin" />
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{row.name || row.raw?.nickname || '—'}</p>
                      {row.username && <p className="text-xs text-neutral">{row.username}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{formatDate(row.dateRaw)}</td>
                    <td className="px-4 py-3">
                      <OptionChip isSick={row.isSick} />
                    </td>
                    <td className="px-4 py-3 max-w-[220px] truncate text-neutral-700" title={row.reason}>
                      {row.reason || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <SignChip sign={row.sign} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {row.fileUrl && (
                          <a
                            href={row.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                            aria-label="Lihat lampiran"
                          >
                            <Icon data={FileText} size={14} />
                          </a>
                        )}
                        {row.sign === 'pending' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              className="text-success"
                              aria-label="Setujui"
                              onPress={() => setPendingAction({ row, sign: 'allow' })}
                            >
                              <Icon data={Check} size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              className="text-danger"
                              aria-label="Tolak"
                              onPress={() => setPendingAction({ row, sign: 'reject' })}
                            >
                              <Icon data={Xmark} size={15} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() =>
                                setPendingAction({ row, sign: row.sign === 'allow' ? 'reject' : 'allow' })
                              }
                            >
                              Ubah
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              className="text-danger"
                              aria-label="Hapus"
                              onPress={() => setPendingDelete({ row })}
                            >
                              <Icon data={TrashBin} size={15} />
                            </Button>
                          </>
                        )}
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
            countLabel={`Halaman ${pageIndex + 1} · ${items.length} pengajuan ditampilkan`}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.sign === 'allow' ? 'Setujui pengajuan ini?' : 'Tolak pengajuan ini?'}
        description={
          pendingAction
            ? `Status pengajuan dari "${pendingAction.row.name}" akan diubah menjadi ${
                pendingAction.sign === 'allow' ? 'Disetujui' : 'Ditolak'
              }.`
            : ''
        }
        confirmLabel={pendingAction?.sign === 'allow' ? 'Setujui' : 'Tolak'}
        danger={pendingAction?.sign === 'reject'}
        loading={processing}
        onConfirm={handleConfirmAction}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Hapus pengajuan izin ini?"
        description={
          pendingDelete
            ? `Pengajuan dari "${pendingDelete.row.name || pendingDelete.row.username}" akan dihapus permanen. Setelah dihapus, status verifikasi tidak bisa diubah lagi.`
            : ''
        }
        confirmLabel="Hapus"
        danger={true}
        loading={processing}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
