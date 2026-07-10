import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { PersonPlus, Pencil, TrashBin, Persons } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { unwrapList, normalizeUser } from '../lib/normalize.js'
import { Toolbar, PagerFooter } from '../components/ListChrome.jsx'
import { TypeChip } from '../components/StatusChip.jsx'
import { ConfirmDialog } from '../components/Modals.jsx'
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

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadPage = useCallback(
    async (index, cursors, term) => {
      setLoading(true)
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
        toast.error(err.message || 'Gagal memuat data siswa.')
      } finally {
        setLoading(false)
      }
    },
    []
  )

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
        if (!cancelled) toast.error(err.message || 'Gagal memuat data siswa.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

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
      toast.success(`Akun ${deleteTarget.username} berhasil dihapus.`)
      setDeleteTarget(null)
      handleRefresh()
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus akun.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Persons}
        eyebrow="Data Siswa"
        title="Siswa"
        description="Kelola akun siswa untuk aplikasi presensi Takota — tambah, ubah, atau hapus akun."
      />

      <Toolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={handleRefresh}
        placeholder="Cari nama atau username siswa…"
        actions={
          <Button variant="primary" size="sm" onPress={openCreate}>
            <Icon data={PersonPlus} size={15} />
            Tambah Siswa
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-app-border/15 bg-neutral-50 text-xs font-medium text-neutral">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral">
                    Memuat data…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8">
                    <EmptyState label="Belum ada data siswa" />
                  </td>
                </tr>
              ) : (
                items.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{user.nickname}</p>
                      {user.callname && user.callname !== user.nickname && (
                        <p className="text-xs text-neutral">{user.callname}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{user.username}</td>
                    <td className="px-4 py-3">
                      <TypeChip type={user.type} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" isIconOnly onPress={() => openEdit(user)} aria-label="Ubah">
                          <Icon data={Pencil} size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          onPress={() => setDeleteTarget(user)}
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
            countLabel={`Halaman ${pageIndex + 1} · ${items.length} siswa ditampilkan`}
          />
        </div>
      </Card>

      <UserFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSaved={handleRefresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus akun siswa?"
        description={
          deleteTarget
            ? `Akun "${deleteTarget.nickname}" (${deleteTarget.username}) akan dihapus permanen dan tidak dapat dikembalikan.`
            : ''
        }
        confirmLabel="Hapus"
        danger
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
