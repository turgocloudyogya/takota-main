import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { At, Key, Eye, EyeSlash, Shield, Fingerprint } from '@gravity-ui/icons'

// Import API and session utilities from admin
import { clearLegacyTokenStorage } from '../lib/cookies.js'
import { getPasskey, webauthnSupported } from '../lib/webauthn.js'

const API_BASE = localStorage.getItem('api-base-url') || ''

async function postJSON(path, body, extraHeaders = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'key-request': 'web-login',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || data?.error?.message || 'Login failed. Check your username and password.')
  }
  return data
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Second-factor step (stays on "/" - no session exists yet).
  const [challenge, setChallenge] = useState(null)
  const [methods, setMethods] = useState([])
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  function enterApp(data, name) {
    clearLegacyTokenStorage()
    const redirectPath = data.redirect || (data.login_as === 'admin' ? '/admin' : '/main')

    if (redirectPath === '/chpw') {
      toast.info('You must change your password first.')
      navigate('/change-password', { replace: true })
    } else {
      toast.success(`Welcome, ${name}!`)
      if (data.login_as === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/main', { replace: true })
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      toast.error('Username and password are required.')
      return
    }

    setSubmitting(true)
    try {
      const data = await postJSON('/api/auth', { username: username.trim(), password })

      if (data.require_2fa) {
        setChallenge(data.challenge)
        setMethods(data.methods || [])
        setCode('')
        toast.info('Enter your second-factor code to continue.')
        return
      }
      enterApp(data, username.trim())
    } catch (err) {
      toast.error(err.message || 'Login failed. Check your connection or API address.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyCode(e) {
    e?.preventDefault()
    if (!code.trim()) {
      toast.error('Enter your 6-digit code or a backup code.')
      return
    }
    setVerifying(true)
    try {
      const data = await postJSON('/api/auth/2fa', { challenge, code: code.trim() })
      enterApp(data, username.trim())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  async function handlePasskeyLogin(withUsername) {
    const name = withUsername || username.trim()
    if (!name) {
      toast.error('Enter your username first to use a passkey.')
      return
    }
    if (!webauthnSupported()) {
      toast.error('Passkeys are not supported in this browser.')
      return
    }
    setVerifying(true)
    try {
      const begin = await postJSON('/api/auth/passkey/begin', { username: name })
      const assertion = await getPasskey(begin.options)
      const response = await fetch(`${API_BASE}/api/auth/passkey/finish`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'key-request': 'web-login',
          'X-Passkey-Challenge': begin.challenge,
        },
        body: JSON.stringify(assertion),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error?.message || data?.message || 'Passkey login failed.')
      enterApp(data, name)
    } catch (err) {
      if (err?.name === 'NotAllowedError') toast.error('Passkey login was cancelled.')
      else toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  // ---- second-factor step -------------------------------------------------
  if (challenge) {
    const passkeyOffered = methods.includes('passkey')
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Icon data={Shield} size={36} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Two-factor verification</h1>
          <p className="mt-2 max-w-[280px] text-center text-sm text-neutral dark:text-neutral-400">
            Enter the 6-digit code from your authenticator app, a backup code, or use your passkey.
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3 dark:bg-neutral-800/60">
            <Icon data={Key} size={16} className="shrink-0 text-neutral dark:text-neutral-400" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 9))}
              placeholder="000000 or XXXX-XXXX"
              autoComplete="one-time-code"
              className="w-full bg-transparent text-center font-mono text-sm tracking-widest text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </label>

          <button
            type="submit"
            disabled={verifying || !code.trim()}
            className="mt-1 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>

          {passkeyOffered && (
            <button
              type="button"
              onClick={() => handlePasskeyLogin(username.trim())}
              disabled={verifying}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <Icon data={Fingerprint} size={16} />
              Use passkey instead
            </button>
          )}

          <button
            type="button"
            onClick={() => { setChallenge(null); setMethods([]); setCode('') }}
            className="text-sm font-medium text-neutral hover:underline dark:text-neutral-400"
          >
            Back to login
          </button>
        </form>
      </main>
    )
  }

  // ---- password step ------------------------------------------------------
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral/15 dark:bg-white/10">
          <img src="/takota-icon.svg" alt="Takota" className="h-12 w-12" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Takota Login</h1>
        <p className="mt-2 max-w-[260px] text-center text-sm text-neutral dark:text-neutral-400">
          Log in with your account. Admins are directed to the admin dashboard, users to the attendance page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3 dark:bg-neutral-800/60">
          <Icon data={At} size={16} className="shrink-0 text-neutral dark:text-neutral-400" />
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3 dark:bg-neutral-800/60">
          <Icon data={Key} size={16} className="shrink-0 text-neutral dark:text-neutral-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral dark:text-neutral-400"
          >
            <Icon data={showPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>


        <button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white cursor-pointer transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => handlePasskeyLogin()}
          disabled={verifying || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          <Icon data={Fingerprint} size={16} />
          {verifying ? 'Waiting for passkey…' : 'Sign in with passkey'}
        </button>
      </form>
    </main>
  )
}
