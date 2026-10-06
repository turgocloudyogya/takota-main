import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Eye, EyeSlash, ShieldKeyhole } from '@gravity-ui/icons'
import { TextField, Input, Label } from '@heroui/react'
import { getProfile } from '../lib/cookies.js'

const MIN_PASSWORD_LENGTH = 6 // Changed from 8 to match backend requirement
const API_BASE = localStorage.getItem('api-base-url') || ''

async function changePasswordAPI(currentPassword, newPassword, repeatPassword) {
  const response = await fetch(`${API_BASE}/api/auth-chpw`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'key-request': 'web-user'
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      repeat_password: repeatPassword
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to change password.')
  }

  return response.json()
}

export default function ChangePassword() {
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()

    // Validation
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error('All fields are required.')
      return
    }
    
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    
    if (newPassword === oldPassword) {
      toast.error('The new password must be different from the old password.')
      return
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('The new password and confirmation do not match.')
      return
    }

    setSubmitting(true)
    try {
      const data = await changePasswordAPI(oldPassword, newPassword, confirmPassword)

      // New session cookie is set by the backend; nothing to store in JS.
      toast.success('Password changed successfully!')

      // Redirect based on response or role
      const redirectPath = data.redirect || '/main'
      const userRole = data.login_as || getProfile()?.role

      if (userRole === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate(redirectPath, { replace: true })
      }
    } catch (err) {
      console.error('Change password error:', err)
      toast.error(err.message || 'Failed to change password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral/15 dark:bg-white/10">
          <Icon data={ShieldKeyhole} size={32} className="text-neutral dark:text-neutral-300" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Change Password</h1>
        <p className="mt-2 max-w-[280px] text-center text-sm text-neutral dark:text-neutral-400">
          Your account is still using the default password. Please set a new password before continuing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TextField fullWidth isRequired name="oldPassword" type={showOldPassword ? 'text' : 'password'} value={oldPassword} onChange={setOldPassword}>
            <Label className="sr-only">Old password</Label>
            <div className="relative">
              <Input
                placeholder="Old Password"
                autoComplete="current-password"
                className="bg-neutral-50 pr-10 shadow-none dark:bg-neutral-800/60"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword((v) => !v)}
                aria-label={showOldPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-3 shrink-0 -translate-y-1/2 cursor-pointer text-neutral transition hover:scale-105 active:scale-90 dark:text-neutral-400"
              >
                <Icon data={showOldPassword ? EyeSlash : Eye} size={16} />
              </button>
            </div>
          </TextField>
        </div>

        <div className="flex items-center gap-2">
          <TextField fullWidth isRequired name="newPassword" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={setNewPassword}>
            <Label className="sr-only">New password</Label>
            <div className="relative">
              <Input
                placeholder="New Password (min. 6 characters)"
                autoComplete="new-password"
                className="bg-neutral-50 pr-10 shadow-none dark:bg-neutral-800/60"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-3 shrink-0 -translate-y-1/2 cursor-pointer text-neutral transition hover:scale-105 active:scale-90 dark:text-neutral-400"
              >
                <Icon data={showNewPassword ? EyeSlash : Eye} size={16} />
              </button>
            </div>
          </TextField>
        </div>

        <div className="flex items-center gap-2">
          <TextField fullWidth isRequired name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={setConfirmPassword}>
            <Label className="sr-only">Confirm new password</Label>
            <div className="relative">
              <Input
                placeholder="Confirm New Password"
                autoComplete="new-password"
                className="bg-neutral-50 pr-10 shadow-none dark:bg-neutral-800/60"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-3 shrink-0 -translate-y-1/2 cursor-pointer text-neutral transition hover:scale-105 active:scale-90 dark:text-neutral-400"
              >
                <Icon data={showConfirmPassword ? EyeSlash : Eye} size={16} />
              </button>
            </div>
          </TextField>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </main>
  )
}