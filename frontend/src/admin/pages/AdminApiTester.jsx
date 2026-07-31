import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card } from '@heroui/react'
import { Icon } from '@gravity-ui/uikit'
import { Play, Copy, CurlyBrackets } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import {
  unwrapList,
  unwrapCursor,
  normalizeUser,
  normalizeAttendance,
  normalizeAbsence,
  normalizePhoto,
} from '../lib/normalize.js'
import { TextInput, SelectInput } from '../components/FormField.jsx'
import PageHeader from '../components/PageHeader.jsx'

// Only read-only (GET) endpoints are exposed here — this page exists purely
// to let you see what the real backend actually returns, since the Bruno/
// OpenCollection docs only specify request shapes. Whatever comes back gets
// run through the same normalizer used by the rest of the dashboard, so you
// can immediately see whether e.g. "nickname" mapped correctly or came out
// blank — and if it did come out blank, adjust src/admin/lib/normalize.js
// to match your backend's real field names.

const ENDPOINTS = {
  globalInfo: {
    label: 'Global Info — GET /api/all/info',
    listKeys: [],
    call: () => api.globalInfo(),
  },
  photos: {
    label: 'Photos / Gallery — GET /api/all/photos',
    listKeys: ['photos'],
    normalize: normalizePhoto,
    call: ({ limit, lastId }) => api.listPhotos({ limit, lastId }),
  },
  users: {
    label: 'List Users — GET /api/admin/users',
    listKeys: ['users'],
    normalize: normalizeUser,
    call: ({ limit, lastId, search }) => api.listUsers({ limit, lastId, search }),
  },
  attendance: {
    label: 'List Attendance — GET /api/admin/attendances',
    listKeys: ['attendances'],
    normalize: normalizeAttendance,
    call: ({ limit, lastId, search }) => api.listAttendance({ limit, lastId, search }),
  },
  absence: {
    label: 'List Absence — GET /api/admin/absences',
    listKeys: ['absences'],
    normalize: normalizeAbsence,
    call: ({ limit, lastId, search }) => api.listAbsence({ limit, lastId, search }),
  },
}

export default function AdminApiTester() {
  const [baseUrlInput, setBaseUrlInput] = useState(api.getBaseUrl())
  const [endpointKey, setEndpointKey] = useState('users')
  const [limit, setLimit] = useState(5)
  const [lastId, setLastId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [raw, setRaw] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(null)
  const [detectedArrayKey, setDetectedArrayKey] = useState(null)

  const config = ENDPOINTS[endpointKey]
  const isListEndpoint = config.listKeys.length > 0

  function detectArrayKey(json) {
    if (Array.isArray(json)) return '(response itself is an array)'
    if (!json || typeof json !== 'object') return null
    const candidates = [...config.listKeys, 'data', 'items', 'results']
    for (const key of candidates) {
      if (Array.isArray(json[key])) return key
      if (json.data && Array.isArray(json.data[key])) return `data.${key}`
    }
    if (json.data && Array.isArray(json.data.items)) return 'data.items'
    return null
  }

  async function handleRun() {
    setLoading(true)
    setRaw(null)
    setDetectedArrayKey(null)
    const started = performance.now()
    try {
      const json = await config.call({ limit, lastId, search })
      setElapsedMs(Math.round(performance.now() - started))
      setRaw(json)
      setDetectedArrayKey(detectArrayKey(json))
    } catch (err) {
      toast.error(err.message || 'Gagal memanggil endpoint.')
    } finally {
      setLoading(false)
    }
  }

  function saveBaseUrl() {
    api.setBaseUrl(baseUrlInput.trim())
    toast.success('Alamat API disimpan untuk perangkat ini.')
  }

  function handleCopy() {
    if (!raw) return
    navigator.clipboard
      .writeText(JSON.stringify(raw, null, 2))
      .then(() => toast.success('JSON disalin ke clipboard.'))
      .catch(() => toast.error('Gagal menyalin ke clipboard.'))
  }

  const normalizedPreview =
    isListEndpoint && raw
      ? unwrapList(raw, ...config.listKeys)
          .slice(0, 3)
          .map(config.normalize)
          .filter(Boolean)
      : []

  const cursorPreview = isListEndpoint && raw ? unwrapCursor(raw) : ''

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={CurlyBrackets}
        eyebrow="Developer Tool"
        title="Uji Respons API"
        description={
          <>
            Dokumentasi Takota (baik file .zip Bruno maupun file .html opencollection) hanya berisi
            spesifikasi <em>request</em> — method, url, dan body — sama sekali tidak ada contoh
            <em> response</em> di dalamnya. Membuka file .html itu di browser hanya menampilkan viewer
            statis dari spesifikasi yang sama; tidak ada panggilan nyata ke server, jadi tidak mungkin
            &quot;dijalankan&quot; untuk mengungkap bentuk respons. Untuk itu memang perlu backend yang
            benar-benar aktif. Panel di bawah ini adalah jalan pintasnya: ia memanggil backend Takota
            Anda yang sesungguhnya (memakai token admin yang sedang login) dan menampilkan hasil
            mentahnya apa adanya, disandingkan dengan hasil normalisasi yang dipakai dashboard.
          </>
        }
      >
        {api.isMockMode() && (
          <p className="mt-1 max-w-2xl rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Mode Pratinjau aktif — JSON di bawah adalah data contoh dari mock lokal, bukan respons
            backend asli. Matikan Mode Pratinjau di halaman Admin Login untuk menguji backend
            sesungguhnya.
          </p>
        )}
      </PageHeader>

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-neutral-900">Alamat Server API</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextInput
            label="Base URL"
            placeholder="http://localhost:8080"
            value={baseUrlInput}
            onChange={(e) => setBaseUrlInput(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" onPress={saveBaseUrl}>
            Simpan
          </Button>
        </div>
        <p className="text-xs text-neutral">
          Default dokumentasi adalah <code>http://localhost:8080</code>. Ganti ke alamat backend Takota
          yang benar-benar bisa diakses dari browser Anda, lalu simpan — dipakai di seluruh dashboard.
        </p>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectInput
            label="Endpoint"
            value={endpointKey}
            onChange={(e) => setEndpointKey(e.target.value)}
            className="lg:col-span-2"
          >
            {Object.entries(ENDPOINTS).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </SelectInput>
          {isListEndpoint && (
            <>
              <TextInput
                type="number"
                label="Limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 5)}
              />
              <TextInput label="last_id" value={lastId} onChange={(e) => setLastId(e.target.value)} />
            </>
          )}
        </div>
        {isListEndpoint && (
          <TextInput
            label="search"
            placeholder="opsional…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        <Button variant="primary" onPress={handleRun} isDisabled={loading} className="self-start">
          <Icon data={Play} size={14} />
          {loading ? 'Memanggil…' : 'Jalankan'}
        </Button>
      </Card>

      {raw !== null && (
        <>
          <Card className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral">
              <span>Waktu respons: {elapsedMs}ms</span>
              {isListEndpoint && (
                <>
                  <span>
                    Kunci array terdeteksi:{' '}
                    <strong className="text-neutral-900">{detectedArrayKey || 'tidak ditemukan'}</strong>
                  </span>
                  <span>
                    Cursor (last_id) berikutnya: <strong className="text-neutral-900">{String(cursorPreview) || '(kosong)'}</strong>
                  </span>
                </>
              )}
            </div>

            {isListEndpoint && normalizedPreview.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-xs font-medium text-neutral-600">
                  Pratinjau setelah dinormalisasi (3 data pertama) — bandingkan dengan JSON mentah di bawah:
                </p>
                <div className="overflow-x-auto rounded-xl border border-app-border/15">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral">
                      <tr>
                        {Object.keys(normalizedPreview[0])
                          .filter((k) => k !== 'raw')
                          .map((k) => (
                            <th key={k} className="px-3 py-2 font-medium">
                              {k}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/10">
                      {normalizedPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.entries(row)
                            .filter(([k]) => k !== 'raw')
                            .map(([k, v]) => (
                              <td key={k} className="px-3 py-2 text-neutral-700">
                                {v === undefined || v === null || v === '' ? (
                                  <span className="text-danger">kosong</span>
                                ) : (
                                  String(v)
                                )}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral">
                  Ada kolom yang selalu "kosong"? Berarti nama field asli dari server berbeda — cek JSON mentah di
                  bawah lalu sesuaikan di <code>src/admin/lib/normalize.js</code>.
                </p>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">JSON Mentah</p>
              <Button variant="ghost" size="sm" onPress={handleCopy}>
                <Icon data={Copy} size={13} />
                Salin
              </Button>
            </div>
            <pre className="max-h-[480px] overflow-auto rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </Card>
        </>
      )}
    </div>
  )
}
