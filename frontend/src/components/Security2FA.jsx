import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Shield, Check, Copy, Trash2 } from '@gravity-ui/icons'
import { Input } from '@heroui/react'

export default function Security2FA() {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupMode, setSetupMode] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Check 2FA status on mount
  useEffect(() => {
    checkTwoFAStatus()
  }, [])

  async function checkTwoFAStatus() {
    try {
      setLoading(true)
      const response = await fetch('/api/user/2fa/status')
      if (!response.ok) throw new Error('Failed to check 2FA status')
      const data = await response.json()
      setTwoFAEnabled(data.data.enabled)
    } catch (err) {
      toast.error('Failed to load 2FA status')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetup2FA() {
    try {
      setLoading(true)
      const response = await fetch('/api/user/2fa/setup', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to setup 2FA')
      const data = await response.json()
      setQrCode(data.data.qr_code)
      setSecret(data.data.secret)
      setSetupMode(true)
      setVerificationCode('')
    } catch (err) {
      toast.error(err.message || 'Failed to setup 2FA')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2FA() {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    try {
      setVerifying(true)
      const response = await fetch('/api/user/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TOTP-Secret': secret,
        },
        body: JSON.stringify({
          code: verificationCode,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to verify 2FA')
      }

      toast.success('2FA enabled successfully!')
      setTwoFAEnabled(true)
      setSetupMode(false)
      setQrCode(null)
      setSecret(null)
      setVerificationCode('')
    } catch (err) {
      toast.error(err.message || 'Failed to verify 2FA')
      console.error(err)
    } finally {
      setVerifying(false)
    }
  }

  async function handleDisable2FA() {
    const code = prompt('Enter your 6-digit authenticator code to disable 2FA:')
    if (!code || code.length !== 6) {
      toast.error('Invalid code')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/user/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to disable 2FA')
      }

      toast.success('2FA disabled successfully')
      setTwoFAEnabled(false)
    } catch (err) {
      toast.error(err.message || 'Failed to disable 2FA')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard() {
    if (secret) {
      navigator.clipboard.writeText(secret)
      toast.success('Secret copied to clipboard')
    }
  }

  if (loading && !setupMode) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10">
        <Icon data={Shield} size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-blue-900 dark:text-blue-200">
          <p className="font-semibold">Two-Factor Authentication</p>
          <p className="mt-1">Add an extra layer of security to your account with time-based one-time passwords (TOTP).</p>
        </div>
      </div>

      {!setupMode ? (
        <>
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Status</p>
              <p className={`text-sm ${twoFAEnabled ? 'text-green-600 dark:text-green-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {twoFAEnabled ? 'Enabled' : 'Not enabled'}
              </p>
            </div>
            {twoFAEnabled ? (
              <button
                type="button"
                onClick={handleDisable2FA}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95"
              >
                <Icon data={Trash2} size={16} />
                Disable
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSetup2FA}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              >
                <Icon data={Shield} size={16} />
                Enable
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
          <div>
            <p className="mb-3 font-medium text-neutral-900 dark:text-neutral-100">Step 1: Scan QR Code</p>
            <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.):
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 font-medium text-neutral-900 dark:text-neutral-100">Step 2: Manual Entry (if needed)</p>
            <div className="flex items-center gap-2 rounded bg-neutral-200 p-2 dark:bg-neutral-700">
              <code className="flex-1 font-mono text-sm text-neutral-900 dark:text-neutral-100">{secret}</code>
              <button
                type="button"
                onClick={copyToClipboard}
                className="p-2 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded transition"
              >
                <Icon data={Copy} size={16} />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 font-medium text-neutral-900 dark:text-neutral-100">Step 3: Verify</p>
            <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">Enter the 6-digit code from your authenticator app:</p>
            <Input
              type="text"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength="6"
              inputMode="numeric"
              className="font-mono text-center"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSetupMode(false)
                setQrCode(null)
                setSecret(null)
                setVerificationCode('')
              }}
              disabled={verifying}
              className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify2FA}
              disabled={verifying || verificationCode.length !== 6}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-95 disabled:opacity-50"
            >
              <Icon data={Check} size={16} />
              {verifying ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
