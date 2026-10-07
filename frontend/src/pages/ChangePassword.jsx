import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Eye, EyeSlash, ShieldKeyhole, Check } from '@gravity-ui/icons'
import { TextField, Input, Label, Button, FieldError } from '@heroui/react'
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
  const [errors, setErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()

    // Validation mirrors the backend rules
    const errs = {}
    if (!oldPassword) errs.oldPassword = 'Old password is required.'
    if (!newPassword) {
      errs.newPassword = 'New password is required.'
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errs.newPassword = `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    } else if (newPassword === oldPassword) {
      errs.newPassword = 'The new password must be different from the old password.'
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password.'
    } else if (newPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = 'The new password and confirmation do not match.'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

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
      setErrors({ oldPassword: err.message || 'Failed to change password.' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleFieldChange(field, value) {
    if (field === 'oldPassword') setOldPassword(value)
    if (field === 'newPassword') setNewPassword(value)
    if (field === 'confirmPassword') setConfirmPassword(value)
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
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
          <TextField fullWidth isRequired name="oldPassword" type={showOldPassword ? 'text' : 'password'} value={oldPassword} onChange={(v) => handleFieldChange('oldPassword', v)} isInvalid={!!errors.oldPassword}>
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
            {errors.oldPassword && <FieldError className="text-xs text-danger">{errors.oldPassword}</FieldError>}
          </TextField>
        </div>

        <div className="flex items-center gap-2">
          <TextField fullWidth isRequired name="newPassword" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(v) => handleFieldChange('newPassword', v)} isInvalid={!!errors.newPassword}>
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
            {errors.newPassword && <FieldError className="text-xs text-danger">{errors.newPassword}</FieldError>}
          </TextField>
        </div>

        <div className="flex items-center gap-2">
          <TextField fullWidth isRequired name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(v) => handleFieldChange('confirmPassword', v)} isInvalid={!!errors.confirmPassword}>
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
            {errors.confirmPassword && <FieldError className="text-xs text-danger">{errors.confirmPassword}</FieldError>}
          </TextField>
        </div>

        <Button
          fullWidth
          variant="primary"
          type="submit"
          isDisabled={submitting}
          className="mt-3 cursor-pointer"
        >
          <Icon data={Check} size={16} />
          {submitting ? 'Changing…' : 'Change Password'}
        </Button>
      </form>
    </main>
  )
}