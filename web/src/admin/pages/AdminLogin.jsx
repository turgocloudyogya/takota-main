import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { At, Key, Eye, EyeSlash, ShieldKeyhole, Gear, Play, TriangleExclamation } from '@gravity-ui/icons'
import * as api from '../lib/api.js'
import { getSession, isAdminSession } from '../lib/session.js'

const DEMO_USERNAME = 'admin'
const DEMO_PASSWORD = 'admin123'

// Deliberately mirrors the student-facing Login page (src/pages/Login.jsx):
// same centered single-column layout, same icon-square avatar, same field
// styling. Admin doesn't get its own visual identity — just its own icon
// and the extra bits (Mode Pratinjau, server settings) it actually needs.
export default function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [baseUrlInput, setBaseUrlInput] = useState(api.getBaseUrl())
  const [mockMode, setMockMode] = useState(api.isMockMode())

  function saveBaseUrl() {
    api.setBaseUrl(baseUrlInput.trim())
    toast.success('Alamat API disimpan.')
    setShowSettings(false)
  }

  function toggleMockMode() {
    const next = !mockMode
    api.setMockMode(next)
    setMockMode(next)
    toast.success(next ? 'Mode Pratinjau diaktifkan.' : 'Mode Pratinjau dimatikan — kini memakai backend asli.')
  }

  async function doLogin(usernameValue, passwordValue) {
    setSubmitting(true)
    try {
      await api.login(usernameValue.trim(), passwordValue)
      const session = getSession()
      if (!isAdminSession(session)) {
        api.logout()
        toast.error('Akun ini bukan akun admin.')
        return
      }
      toast.success(`Selamat datang, ${session.username}.`)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Username atau password salah.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Username dan password wajib diisi.')
      return
    }
    doLogin(username, password)
  }

  function handleQuickPreview() {
    setUsername(DEMO_USERNAME)
    setPassword(DEMO_PASSWORD)
    doLogin(DEMO_USERNAME, DEMO_PASSWORD)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral/15">
          <Icon data={ShieldKeyhole} size={32} className="text-neutral" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900">Admin Login</h1>
        <p className="mt-2 max-w-[280px] text-center text-sm text-neutral">
          Masuk untuk mengelola presensi dan data siswa Takota.
        </p>
      </div>

      {mockMode && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-warning/10 px-3.5 py-3 text-warning">
          <Icon data={TriangleExclamation} size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">Mode Pratinjau aktif.</span> Backend Takota belum tersambung, jadi
            dashboard ini berjalan dengan data contoh untuk melihat desainnya terlebih dahulu. Tidak ada data
            asli yang berubah.
          </p>
        </div>
      )}

      {mockMode && (
        <button
          type="button"
          onClick={handleQuickPreview}
          disabled={submitting}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-semibold text-primary transition active:scale-[0.98] disabled:opacity-60"
        >
          <Icon data={Play} size={15} />
          {submitting ? 'Masuk…' : 'Masuk Cepat ke Mode Pratinjau'}
        </button>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3">
          <Icon data={At} size={16} className="shrink-0 text-neutral" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username admin"
            autoComplete="username"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3">
          <Icon data={Key} size={16} className="shrink-0 text-neutral" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral"
          >
            <Icon data={showPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Masuk…' : 'Masuk sebagai Admin'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setShowSettings((v) => !v)}
        className="mx-auto mt-6 flex items-center gap-1.5 text-xs font-medium text-neutral"
      >
        <Icon data={Gear} size={13} />
        Pengaturan alamat server
      </button>

      {showSettings && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-neutral-50 p-3.5">
          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-xs font-medium text-neutral-700">Mode Pratinjau (Data Contoh)</span>
              <span className="text-xs text-neutral">
                Nyalakan bila backend Takota belum aktif. Matikan begitu backend asli sudah bisa diakses.
              </span>
            </span>
            <input
              type="checkbox"
              checked={mockMode}
              onChange={toggleMockMode}
              className="h-4 w-4 shrink-0 accent-primary"
            />
          </label>

          <div className="border-t border-app-border/15 pt-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">Base URL API</span>
              <input
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="http://localhost:8080"
                className="w-full rounded-lg bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
              />
            </label>
            <p className="mt-2 text-xs text-neutral">
              Dipakai saat Mode Pratinjau dimatikan. Ganti kalau backend Takota tidak berjalan di{' '}
              <code>localhost:8080</code>.
            </p>
            <button
              type="button"
              onClick={saveBaseUrl}
              className="mt-2 self-start rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Simpan
            </button>
          </div>

          {mockMode && (
            <p className="border-t border-app-border/15 pt-3 text-xs text-neutral">
              Login contoh: <code>{DEMO_USERNAME}</code> / <code>{DEMO_PASSWORD}</code>
            </p>
          )}
        </div>
      )}
    </main>
  )
}
