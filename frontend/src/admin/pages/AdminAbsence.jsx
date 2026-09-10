import { useCallback, useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button, Label, DatePicker, DateField, Calendar } from '@heroui/react'
import { parseDate } from '@internationalized/date'
import { Icon } from '@gravity-ui/uikit'
import { Check, Xmark, FileText, FileCheck, TrashBin, Pencil, ChevronDown, ChevronUp } from '@gravity-ui/icons'
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

function toCalendarDate(str) {
  if (!str) return null
  try {
    const [y, m, d] = String(str).split('-').map(Number)
    return parseDate(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  } catch {
    return null
  }
}

function toISODate(date) {
  if (!date) return ''
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function EndDatePicker({ value, min, onChange }) {
  return (
    <DatePicker
      value={toCalendarDate(value)}
      onChange={(date) => onChange(toISODate(date))}
      minValue={toCalendarDate(min)}
      fullWidth
      className="w-full"
    >
      <Label>End date</Label>
      <DateField.Group fullWidth className="w-full bg-neutral-100 dark:bg-neutral-900 shadow-none">
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label="Choose end date">
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  )
}

function StartDatePicker({ value, onChange }) {
  return (
    <DatePicker
      value={toCalendarDate(value)}
      onChange={(date) => onChange(toISODate(date))}
      fullWidth
      className="w-full"
    >
      <Label>Start date</Label>
      <DateField.Group fullWidth className="w-full bg-neutral-100 dark:bg-neutral-900 shadow-none">
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label="Choose start date">
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  )
}

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
  const [pendingAction, setPendingAction] = useState(null) // { row, sign, startDate, endDate }
  const [pendingDelete, setPendingDelete] = useState(null) // { row }
  const [processing, setProcessing] = useState(false)
  const [expandedReason, setExpandedReason] = useState(null)

  function openAction(row, sign) {
    setPendingAction({
      row,
      sign,
      startDate: row.startDate || '',
      endDate: row.endDate || '',
    })
  }

  function periodLabel(row) {
    if (row.isMultiDay && row.startDate && row.endDate) {
      return `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`
    }
    return formatDate(row.dateRaw)
  }

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
    const { row, sign } = pendingAction
    const datesChanged =
      row.isMultiDay &&
      pendingAction.startDate &&
      pendingAction.endDate &&
      (pendingAction.startDate !== (row.startDate || '') ||
        pendingAction.endDate !== (row.endDate || ''))
    // Changing the period requires approval (backend enforces this too).
    const finalSign = datesChanged ? 'allow' : sign
    if (datesChanged && sign !== 'allow') {
      toast.info('Period changed — the submission will be approved.')
    }
    setProcessing(true)
    try {
      await api.signAbsence(
        row.id,
        finalSign,
        datesChanged
          ? { startDate: pendingAction.startDate, endDate: pendingAction.endDate }
          : {},
      )
      toast.success(finalSign === 'allow' ? 'Submission approved.' : 'Submission rejected.')
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

      <div data-guide="absence-table" className="flex flex-col gap-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-neutral dark:text-neutral-400">
            Loading data…
          </p>
        ) : items.length === 0 ? (
          <div className="py-8">
            <EmptyState label="No leave submissions yet" />
          </div>
        ) : (
          items.map((row) => {
            const expanded = expandedReason === row.id
            return (
              <div
                key={row.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{row.name || row.raw?.nickname || '-'}</p>
                    {row.username && <p className="truncate text-xs text-neutral dark:text-neutral-400">@{row.username}</p>}
                  </div>
                  <SignChip sign={row.sign} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                  <span>{periodLabel(row)}</span>
                  {row.isMultiDay && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Multi-day
                    </span>
                  )}
                  <OptionChip isSick={row.isSick} />
                </div>
                {row.reason && (
                  <div className="mt-2">
                    <p className={`text-sm text-neutral-700 dark:text-neutral-300 ${expanded ? '' : 'line-clamp-2'}`}>
                      {row.reason}
                    </p>
                    {row.reason.length > 120 && (
                      <button
                        type="button"
                        onClick={() => setExpandedReason(expanded ? null : row.id)}
                        className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {expanded ? 'Show less' : 'Show more'}
                        <Icon data={expanded ? ChevronUp : ChevronDown} size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {row.fileUrl && (
                    <button
                      type="button"
                      onClick={() => downloadFile(row.fileUrl, row.fileUrl.split('/').pop() || 'attachment')}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
                        onPress={() => openAction(row, 'allow')}
                      >
                        <Icon data={Check} size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        className="text-danger"
                        aria-label="Reject"
                        onPress={() => openAction(row, 'reject')}
                      >
                        <Icon data={Xmark} size={15} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label="Change status"
                        onPress={() =>
                          openAction(row, row.sign === 'allow' ? 'reject' : 'allow')
                        }
                      >
                        <Icon data={Pencil} size={14} />
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
        countLabel={`Page ${pageIndex + 1} · ${items.length} submissions shown`}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.sign === 'allow' ? 'Approve this submission?' : 'Reject this submission?'}
        description={
          pendingAction ? (
            <span className="block">
              {`The submission status for "${pendingAction.row.name}" will be changed to ${
                pendingAction.sign === 'allow' ? 'Approved' : 'Rejected'
              }.`}
              {pendingAction.row.isMultiDay ? (
                <span className="mt-3 block">
                  <span className="block text-xs text-neutral dark:text-neutral-400">
                    Edit period (multi-day only — changing it approves the submission)
                  </span>
                  <span className="mt-2 block">
                    <StartDatePicker
                      value={pendingAction.startDate}
                      onChange={(v) =>
                        setPendingAction((prev) => (prev ? { ...prev, startDate: v } : prev))
                      }
                    />
                  </span>
                  <span className="mt-2 block">
                    <EndDatePicker
                      value={pendingAction.endDate}
                      min={pendingAction.startDate || undefined}
                      onChange={(v) =>
                        setPendingAction((prev) => (prev ? { ...prev, endDate: v } : prev))
                      }
                    />
                  </span>
                </span>
              ) : (
                <span className="mt-2 block text-xs text-neutral dark:text-neutral-400">
                  Single-day submissions cannot have their date edited.
                </span>
              )}
            </span>
          ) : (
            ''
          )
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
