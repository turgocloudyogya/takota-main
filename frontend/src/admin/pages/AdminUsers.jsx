import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { PersonPlus, Pencil, TrashBin, Persons, Layers, Person, ShieldKeyhole } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeUser } from '../lib/normalize.js'
import { Toolbar, PagerFooter, SegmentedFilter } from '../components/ListChrome.jsx'
import { TypeChip } from '../components/StatusChip.jsx'
import { ConfirmDialog } from '../../components/Modals.jsx'
import UserFormModal from '../components/UserFormModal.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'

const LIMIT = 15

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageIndex, setPageIndex] = useState(0)
  const [lastIds, setLastIds] = useState([''])
  const [hasNext, setHasNext] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'user' | 'admin' - view-only split of the current page

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const typeCounts = useMemo(
    () => ({
      all: items.length,
      user: items.filter((u) => u.type !== 'admin').length,
      admin: items.filter((u) => u.type === 'admin').length,
    }),
    [items]
  )

  const filteredItems = useMemo(() => {
    if (typeFilter === 'all') return items
    return items.filter((u) => (typeFilter === 'admin' ? u.type === 'admin' : u.type !== 'admin'))
  }, [items, typeFilter])

  const filterNoun = typeFilter === 'admin' ? 'admin' : typeFilter === 'user' ? 'student' : 'user'

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

  const loadPage = useCallback(
    async (index, cursors, term, isPolling = false) => {
      // Only show loading spinner if not polling
      if (!isPolling) {
        setLoading(true)
      }
      try {
        const json = await api.listUsers({ limit: LIMIT, lastId: cursors[index] || '', search: term })
        const rawList = unwrapList(json, 'users')
        const normalized = rawList.map(normalizeUser).filter(Boolean)
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
          toast.error(err.message || 'Failed to load user data.')
        }
      } finally {
        if (!isPolling) {
          setLoading(false)
        }
      }
    },
    []
  )

  // Initial data load only
  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const json = await api.listUsers({ limit: LIMIT, lastId: '', search: '' })
        const rawList = unwrapList(json, 'users')
        const normalized = rawList.map(normalizeUser).filter(Boolean)
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
        if (!cancelled) toast.error(err.message || 'Failed to load user data.')
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

  function openCreate() {
    setEditingUser(null)
    setFormOpen(true)
  }

  function openEdit(user) {
    setEditingUser(user)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteUser(deleteTarget.id)
      toast.success(`Account ${deleteTarget.username} deleted successfully.`)
      setDeleteTarget(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to delete account.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Persons}
        eyebrow="User Data"
        title="Users"
        description="Manage user accounts (students & admins) for the Takota attendance app, add, edit, or delete accounts."
      />

      <SegmentedFilter
        value={typeFilter}
        onChange={setTypeFilter}
        options={[
          { key: 'all', label: 'All', count: typeCounts.all, icon: Layers, tone: 'neutral' },
          { key: 'user', label: 'Students', count: typeCounts.user, icon: Person, tone: 'neutral' },
          { key: 'admin', label: 'Admin', count: typeCounts.admin, icon: ShieldKeyhole, tone: 'accent' },
        ]}
      />

      <Toolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={handleRefresh}
        placeholder="Search name or username…"
        actions={
          <Button variant="primary" size="sm" onPress={openCreate}>
            <Icon data={PersonPlus} size={15} />
            Add {typeFilter === 'admin' ? 'Admin' : typeFilter === 'user' ? 'Student' : 'User'}
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-app-border/15 bg-neutral-50 text-xs font-medium text-neutral dark:border-white/10 dark:bg-neutral-800/60 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/10 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral dark:text-neutral-400">
                    Loading data…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8">
                    <EmptyState
                      label={
                        items.length === 0
                          ? 'No user data yet'
                          : `No ${filterNoun} accounts on this page`
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredItems.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{user.nickname}</p>
                      {user.callname && user.callname !== user.nickname && (
                        <p className="text-xs text-neutral dark:text-neutral-400">{user.callname}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{user.username}</td>
                    <td className="px-4 py-3">
                      <TypeChip type={user.type} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" isIconOnly onPress={() => openEdit(user)} aria-label="Edit">
                          <Icon data={Pencil} size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          onPress={() => setDeleteTarget(user)}
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
            countLabel={
              typeFilter === 'all'
                ? `Page ${pageIndex + 1} · ${items.length} users shown`
                : `Page ${pageIndex + 1} · ${filteredItems.length} of ${items.length} users (${filterNoun})`
            }
          />
        </div>
      </Card>

      <UserFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSaved={handleRefresh}
        defaultType={typeFilter === 'admin' ? 'admin' : 'user'}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type === 'admin' ? 'admin' : 'student'} account?`}
        description={
          deleteTarget
            ? `The account "${deleteTarget.nickname}" (${deleteTarget.username}) will be permanently deleted and cannot be recovered.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}