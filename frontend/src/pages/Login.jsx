import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { At, Key, Eye, EyeSlash } from '@gravity-ui/icons'

// Import API and session utilities from admin
const API_BASE = localStorage.getItem('api-base-url') || ''

async function loginAPI(username, password) {
  const response = await fetch(`${API_BASE}/api/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'key-request': 'web-login'
    },
    body: JSON.stringify({ username, password })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Login failed. Check your username and password.')
  }

  return response.json()
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      toast.error('Username and password are required.')
      return
    }

    setSubmitting(true)
    try {
      const data = await loginAPI(username.trim(), password)
      
      // Clear any old session keys first
      localStorage.removeItem('takota-token')
      
      // Save session using the same key as admin (takota_admin_token)
      localStorage.setItem('takota_admin_token', data.token)
      localStorage.setItem('takota_token', data.token) // Also save with this key for compatibility
      localStorage.setItem('takota-username', username.trim())
      localStorage.setItem('takota-role', data.login_as)

      // Check if password change is required
      const redirectPath = data.redirect || (data.login_as === 'admin' ? '/admin' : '/main')
      
      if (redirectPath === '/chpw') {
        toast.info('You must change your password first.')
        navigate('/change-password', { replace: true })
      } else {
        toast.success(`Welcome, ${username}!`)
        
        // Redirect based on backend response or role
        if (data.login_as === 'admin') {
          navigate('/admin/dashboard', { replace: true })
        } else {
          navigate('/main', { replace: true })
        }
      }
    } catch (err) {
      toast.error(err.message || 'Login failed. Check your connection or API address.')
    } finally {
      setSubmitting(false)
    }
  }

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
      </form>
    </main>
  )
}
