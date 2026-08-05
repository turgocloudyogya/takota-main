import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { Check, Xmark, FileText, FileCheck, TrashBin } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeAbsence } from '../lib/normalize.js'
import { parseApiDate } from '../lib/dateWindow.js'
import { downloadFile } from '../../lib/download.js'
import { Toolbar, PagerFooter } from '../components/ListChrome.jsx'
import { OptionChip, SignChip } from '../components/StatusChip.jsx'
import { ConfirmDialog } from '../../components/Modals.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'

const LIMIT = 15

function formatDate(dateRaw) {
  const d = parseApiDate(dateRaw)
  if (!d) return dateRaw || '-'
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
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
        toast.error(err.message || 'Failed to load leave data.')
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
        if (!cancelled) toast.error(err.message || 'Failed to load leave data.')
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
      toast.success(pendingAction.sign === 'allow' ? 'Submission approved.' : 'Submission rejected.')
      setPendingAction(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to update submission status.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setProcessing(true)
    try {
      await api.deleteAbsence(pendingDelete.row.id)
      toast.success('Leave submission deleted successfully.')
      setPendingDelete(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to delete submission.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileCheck}
        eyebrow="Submissions"
        title="Leave & Sick"
        description="Review and approve/reject students' leave or sick submissions."
      />

      <Toolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={handleRefresh}
        placeholder="Search name or username…"
      />

      <Card data-guide="absence-table" className="overflow-hidden p-0 shadow-none dark:border-neutral-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-app-border/15 bg-neutral-50 text-xs font-medium text-neutral dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/10 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral dark:text-neutral-400">
                    Loading data…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState label="No leave submissions yet" />
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{row.name || row.raw?.nickname || '-'}</p>
                      {row.username && <p className="text-xs text-neutral dark:text-neutral-400">{row.username}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{formatDate(row.dateRaw)}</td>
                    <td className="px-4 py-3">
                      <OptionChip isSick={row.isSick} />
                    </td>
                    <td className="px-4 py-3 max-w-[220px] truncate text-neutral-700 dark:text-neutral-300" title={row.reason}>
                      {row.reason || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <SignChip sign={row.sign} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {row.fileUrl && (
                          <button
                            type="button"
                            onClick={() => downloadFile(row.fileUrl, row.fileUrl.split('/').pop() || 'attachment')}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            aria-label="Download attachment"
                          >
                            <Icon data={FileText} size={14} />
                          </button>
                        )}
                        {row.sign === 'pending' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              className="text-success"
                              aria-label="Approve"
                              onPress={() => setPendingAction({ row, sign: 'allow' })}
                            >
                              <Icon data={Check} size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              className="text-danger"
                              aria-label="Reject"
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
                              Change
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              className="text-danger"
                              aria-label="Delete"
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
            countLabel={`Page ${pageIndex + 1} · ${items.length} submissions shown`}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.sign === 'allow' ? 'Approve this submission?' : 'Reject this submission?'}
        description={
          pendingAction
            ? `The submission status for "${pendingAction.row.name}" will be changed to ${
                pendingAction.sign === 'allow' ? 'Approved' : 'Rejected'
              }.`
            : ''
        }
        confirmLabel={pendingAction?.sign === 'allow' ? 'Approve' : 'Reject'}
        danger={pendingAction?.sign === 'reject'}
        loading={processing}
        onConfirm={handleConfirmAction}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this leave submission?"
        description={
          pendingDelete
            ? `The submission from "${pendingDelete.row.name || pendingDelete.row.username}" will be permanently deleted. After deletion, the verification status can no longer be changed.`
            : ''
        }
        confirmLabel="Delete"
        danger={true}
        loading={processing}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
