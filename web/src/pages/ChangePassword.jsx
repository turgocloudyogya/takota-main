import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Key, Eye, EyeSlash, ShieldKeyhole } from '@gravity-ui/icons'

const MIN_PASSWORD_LENGTH = 8

export default function ChangePassword() {
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error('All fields are required.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword === oldPassword) {
      toast.error('New password must be different from the old password.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.')
      return
    }

    setSubmitting(true)
    // Mock password update — replace with a real API call.
    setTimeout(() => {
      setSubmitting(false)
      toast.success('Password changed successfully.')
      navigate('/main')
    }, 400)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral/15">
          <Icon data={ShieldKeyhole} size={32} className="text-neutral" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900">Change Password</h1>
        <p className="mt-2 max-w-[280px] text-center text-sm text-neutral">
          Your account is still using the default password. Please set a new password before
          continuing
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3">
          <Icon data={Key} size={16} className="shrink-0 text-neutral" />
          <input
            type={showOldPassword ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Old Password"
            autoComplete="current-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />
          <button
            type="button"
            onClick={() => setShowOldPassword((v) => !v)}
            aria-label={showOldPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral"
          >
            <Icon data={showOldPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3">
          <Icon data={Key} size={16} className="shrink-0 text-neutral" />
          <input
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            autoComplete="new-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral"
          >
            <Icon data={showNewPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3">
          <Icon data={Key} size={16} className="shrink-0 text-neutral" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            autoComplete="new-password"
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="shrink-0 text-neutral"
          >
            <Icon data={showConfirmPassword ? EyeSlash : Eye} size={16} />
          </button>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </main>
  )
}