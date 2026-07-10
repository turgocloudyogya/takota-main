import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { At, Key, Eye, EyeSlash, Person } from '@gravity-ui/icons'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      toast.error('Username and password are required.')
      return
    }

    setSubmitting(true)
    // Mock authentication — replace with a real API call.
    setTimeout(() => {
      setSubmitting(false)
      toast.success('Logged in successfully.')
      navigate('/main')
    }, 400)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral/15">
          <Icon data={Person} size={32} className="text-neutral" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900">Log In</h1>
        <p className="mt-2 max-w-[260px] text-center text-sm text-neutral">
          To log in to this app, please enter your username and password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl  bg-neutral-50 px-3.5 py-3">
          <Icon data={At} size={16} className="shrink-0 text-neutral" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl  bg-neutral-50 px-3.5 py-3">
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
          {submitting ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </main>
  )
}
