import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Key, Eye, EyeSlash, ShieldKeyhole } from '@gravity-ui/icons'

const MIN_PASSWORD_LENGTH = 6 // Changed from 8 to match backend requirement
const API_BASE = localStorage.getItem('api-base-url') || ''

async function changePasswordAPI(currentPassword, newPassword, repeatPassword) {
  const token = localStorage.getItem('takota_admin_token') || localStorage.getItem('takota_token')
  
  if (!token) {
    throw new Error('Session expired. Please login again.')
  }

  const response = await fetch(`${API_BASE}/api/auth-chpw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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
      
      // Update token with new one from response
      if (data.token) {
        localStorage.setItem('takota_admin_token', data.token)
        localStorage.setItem('takota_token', data.token)
      }
      
      toast.success('Password changed successfully!')
      
      // Redirect based on response or role
      const redirectPath = data.redirect || '/main'
      const userRole = localStorage.getItem('takota-role')
      
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
        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3 dark:bg-neutral-800/60">
          <Icon data={Key} size={16} className="shrink-0 text-neutral dark:text-neutral-400" />
          <input
            type={showOldPassword ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Old Password"
            autoComplete="current-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={() => setShowOldPassword((v) => !v)}
            aria-label={showOldPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral dark:text-neutral-400"
          >
            <Icon data={showOldPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3 dark:bg-neutral-800/60">
          <Icon data={Key} size={16} className="shrink-0 text-neutral dark:text-neutral-400" />
          <input
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password (min. 6 characters)"
            autoComplete="new-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral dark:text-neutral-400"
          >
            <Icon data={showNewPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3 dark:bg-neutral-800/60">
          <Icon data={Key} size={16} className="shrink-0 text-neutral dark:text-neutral-400" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            autoComplete="new-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral dark:text-neutral-400"
          >
            <Icon data={showConfirmPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

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