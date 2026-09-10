import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@gravity-ui/uikit'
import { Shield, ShieldCheck, Key, Copy, TrashBin, Check, Plus, Fingerprint, FileArrowDown } from '@gravity-ui/icons'
import { Checkbox } from '@heroui/react'
import { jsPDF } from 'jspdf'
import { ConfirmDialog } from './Modals.jsx'
import { createPasskey, webauthnSupported } from '../lib/webauthn.js'

async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `Request failed (${res.status})`)
  return data
}

function formatGeneratedAt(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BackupCodesDisplay({ codes, generatedAt, onDone }) {
  const [saved, setSaved] = useState(false)
  const generatedLabel = formatGeneratedAt(generatedAt || new Date())

  function copyAll() {
    navigator.clipboard.writeText(codes.join('\n')).then(
      () => toast.success('Backup codes copied'),
      () => toast.error('Copy failed, please copy manually'),
    )
  }

  function fileStamp() {
    const d = generatedAt instanceof Date ? generatedAt : new Date(generatedAt || Date.now())
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  }

  function downloadTxt() {
    const lines = [
      'Takota Backup Codes',
      `Generated: ${generatedLabel}`,
      '',
      'Each code works ONCE as a replacement for your authenticator',
      '(e.g. when you lose your phone). Keep them somewhere safe.',
      '',
      ...codes,
      '',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `takota-backup-codes-${fileStamp()}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Backup codes downloaded (.txt)')
  }

  function downloadPdf() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      let y = 20
      doc.setFontSize(18)
      doc.text('Takota Backup Codes', 15, y)
      y += 8
      doc.setFontSize(11)
      doc.text(`Generated: ${generatedLabel}`, 15, y)
      y += 8
      doc.text('Each code works ONCE as a replacement for your authenticator.', 15, y)
      y += 6
      doc.text('Keep them somewhere safe.', 15, y)
      y += 10
      doc.setFont('courier', 'normal')
      doc.setFontSize(13)
      codes.forEach((code, i) => {
        doc.text(`${String(i + 1).padStart(2, '0')}.  ${code}`, 15, y)
        y += 8
      })
      doc.save(`takota-backup-codes-${fileStamp()}.pdf`)
      toast.success('Backup codes downloaded (.pdf)')
    } catch {
      toast.error('PDF download failed')
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Save these backup codes now
      </p>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        Each code works <strong>once</strong> as a replacement for your authenticator
        (e.g. when you lose your phone). They will <strong>never be shown again</strong>.
        Generated: {generatedLabel}
      </p>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-white p-3 font-mono text-sm dark:bg-neutral-900">
        {codes.map((code) => (
          <span key={code} className="select-all text-neutral-900 dark:text-neutral-100">{code}</span>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copyAll}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          <Icon data={Copy} size={14} />
          Copy all
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          <Icon data={FileArrowDown} size={14} />
          .txt
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          <Icon data={FileArrowDown} size={14} />
          .pdf
        </button>
        <button
          type="button"
          onClick={() => saved && onDone()}
          disabled={!saved}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 active:scale-95 disabled:opacity-50"
        >
          <Icon data={Check} size={14} />
          I saved them
        </button>
      </div>
      <Checkbox isSelected={saved} onChange={setSaved}>
        <Checkbox.Content>
          <Checkbox.Control className="bg-neutral-50 border border-neutral-200 size-4 rounded-sm before:rounded-sm dark:bg-neutral-800 dark:border-neutral-700">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            I stored these codes somewhere safe
          </span>
        </Checkbox.Content>
      </Checkbox>
    </div>
  )
}

// Self-service security settings (TOTP authenticator + passkeys + backup
// codes). apiBase selects whose settings: "/api/user" or "/api/admin".
// Everything operates on the logged-in account only.
export default function SecuritySettings({ apiBase }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const [confirmTotp, setConfirmTotp] = useState(false)
  const [setup, setSetup] = useState(null) // {secret, qr}
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [freshBackup, setFreshBackup] = useState(null)

  const [disableMode, setDisableMode] = useState(false)
  const [regenMode, setRegenMode] = useState(false)

  const [passkeys, setPasskeys] = useState([])
  const [passkeyName, setPasskeyName] = useState('')
  const [addingPasskey, setAddingPasskey] = useState(false)
  const [confirmPasskey, setConfirmPasskey] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api(apiBase, '/2fa/status')
        const pk = await api(apiBase, '/passkey').catch(() => ({ passkeys: [] }))
        if (cancelled) return
        setStatus({
          totp: Boolean(data.totp_enabled),
          passkey: Boolean(data.passkey_enabled),
          passkeyCount: data.passkey_count || 0,
          backupRemaining: data.backup_remaining || 0,
        })
        setPasskeys(pk.passkeys || [])
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load security settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [apiBase, reloadKey])

  async function startTotpSetup() {
    setConfirmTotp(false)
    try {
      setLoading(true)
      const data = await api(apiBase, '/2fa/setup', { method: 'POST' })
      setSetup({ secret: data.secret, qr: data.qr_code })
      setCode('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmTotpSetup() {
    if (code.replace(/\D/g, '').length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app')
      return
    }
    try {
      setVerifying(true)
      const data = await api(apiBase, '/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: code.replace(/\D/g, '') }),
      })
      setSetup(null)
      setCode('')
      setFreshBackup({ codes: data.backup_codes || [], at: new Date() })
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  async function disableTotp() {
    if (code.replace(/\D/g, '').length !== 6 && code.trim().length < 9) {
      toast.error('Enter your 6-digit code or an unused backup code')
      return
    }
    try {
      setVerifying(true)
      await api(apiBase, '/2fa/disable', { method: 'POST', body: JSON.stringify({ code: code.trim() }) })
      toast.success('Authenticator 2FA disabled')
      setDisableMode(false)
      setCode('')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  async function regenerateCodes() {
    if (code.replace(/\D/g, '').length !== 6 && code.trim().length < 9) {
      toast.error('Enter your 6-digit code or an unused backup code')
      return
    }
    try {
      setVerifying(true)
      const data = await api(apiBase, '/2fa/backup-codes/regenerate', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })
      setRegenMode(false)
      setCode('')
      setFreshBackup({ codes: data.backup_codes || [], at: new Date() })
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  async function addPasskey() {
    if (!webauthnSupported()) {
      toast.error('Passkeys are not supported in this browser')
      return
    }
    setConfirmPasskey(false)
    try {
      setAddingPasskey(true)
      const begin = await api(apiBase, '/passkey/register/begin', { method: 'POST' })
      const credential = await createPasskey(begin.options)
      const done = await fetch(`${apiBase}/passkey/register/finish`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Passkey-Challenge': begin.challenge,
          'X-Passkey-Name': passkeyName.trim(),
        },
        body: JSON.stringify(credential),
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error?.message || data?.message || `Request failed (${res.status})`)
        return data
      })
      toast.success(done.message || 'Passkey added successfully')
      if (done.backup_codes?.length) setFreshBackup({ codes: done.backup_codes, at: new Date() })
      setPasskeyName('')
      refresh()
    } catch (err) {
      if (err?.name === 'NotAllowedError') toast.error('Passkey setup was cancelled')
      else toast.error(err.message || 'Failed to add passkey')
    } finally {
      setAddingPasskey(false)
    }
  }

  async function deletePasskey(id) {
    try {
      await api(apiBase, `/passkey/${encodeURIComponent(id)}`, { method: 'DELETE' })
      toast.success('Passkey removed')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function copySecret() {
    if (setup?.secret) {
      navigator.clipboard.writeText(setup.secret).then(
        () => toast.success('Secret copied'),
        () => toast.error('Copy failed'),
      )
    }
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading security settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10">
        <Icon data={Shield} size={20} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-900 dark:text-blue-200">
          <p className="font-semibold">Authentication Security (optional, recommended)</p>
          <p className="mt-1">
            Two-factor authentication adds a second proof of identity after your password.
            Use an authenticator app (Google Authenticator, Authy, …) that shows a 6-digit
            code changing every 30 seconds, or a passkey (fingerprint / face / security key)
            that signs in without typing anything. Either way you also get backup codes for
            emergencies. Everything here affects only your own account.
          </p>
        </div>
      </div>

      {freshBackup && (
        <BackupCodesDisplay codes={freshBackup.codes} generatedAt={freshBackup.at} onDone={() => setFreshBackup(null)} />
      )}

      {/* Authenticator app */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status?.totp ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
              <Icon data={status?.totp ? ShieldCheck : Shield} size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Authenticator app</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {status?.totp ? 'Enabled' : 'Not enabled'} · {status?.backupRemaining ?? 0} backup codes left
              </p>
            </div>
          </div>
          {!status?.totp ? (
            <button
              type="button"
              onClick={() => setConfirmTotp(true)}
              className="shrink-0 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 active:scale-95"
            >
              Enable
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setDisableMode((v) => !v); setRegenMode(false); setSetup(null); setCode('') }}
              className="shrink-0 whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-95"
            >
              Disable
            </button>
          )}
        </div>

        {setup && (
          <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">1. Scan this QR code with your authenticator app</p>
            <div className="flex justify-center rounded-lg bg-white p-3">
              <img src={setup.qr} alt="2FA QR code" className="h-48 w-48" />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-neutral-100 p-2 dark:bg-neutral-800">
              <code className="flex-1 break-all font-mono text-xs text-neutral-900 dark:text-neutral-100">{setup.secret}</code>
              <button type="button" onClick={copySecret} aria-label="Copy secret" className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700">
                <Icon data={Copy} size={16} />
              </button>
            </div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">2. Enter the 6-digit code to confirm</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="w-full rounded-lg bg-neutral-100 px-3.5 py-2.5 text-center font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSetup(null); setCode('') }}
                disabled={verifying}
                className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmTotpSetup}
                disabled={verifying || code.length !== 6}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-green-700 active:scale-95 disabled:opacity-50"
              >
                <Icon data={Check} size={14} />
                {verifying ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        )}

        {disableMode && status?.totp && (
          <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <p className="text-xs text-neutral-600 dark:text-neutral-400">Confirm with your 6-digit code or an unused backup code:</p>
            <input
              type="text"
              placeholder="6-digit code or XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 9))}
              className="w-full rounded-lg bg-neutral-100 px-3.5 py-2.5 text-center font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={disableTotp}
              disabled={verifying || !code.trim()}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
            >
              {verifying ? 'Checking...' : 'Confirm disable'}
            </button>
          </div>
        )}

        {(status?.totp || status?.passkey) && !disableMode && (
          <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
            {!regenMode ? (
              <button
                type="button"
                onClick={() => { setRegenMode(true); setCode('') }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Regenerate backup codes ({status?.backupRemaining ?? 0} left)
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Old codes stop working. Confirm with your 6-digit code or an unused backup code:
                </p>
                <input
                  type="text"
                  placeholder="6-digit code or XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 9))}
                  className="w-full rounded-lg bg-neutral-100 px-3.5 py-2.5 text-center font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setRegenMode(false); setCode('') }}
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={regenerateCodes}
                    disabled={verifying || !code.trim()}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                  >
                    {verifying ? 'Checking...' : 'Generate new codes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Passkey */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status?.passkey ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
              <Icon data={Fingerprint} size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Passkey</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {status?.passkey ? `${status.passkeyCount} registered` : 'Not enabled'} · sign in with fingerprint, face, or security key
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmPasskey(true)}
            disabled={addingPasskey}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 active:scale-95 disabled:opacity-50"
          >
            <Icon data={Plus} size={14} />
            {addingPasskey ? 'Waiting...' : status?.passkey ? 'Add another' : 'Enable as Passkey'}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Passkey name (e.g. My phone)"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value.slice(0, 100))}
            className="w-full rounded-lg bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        {passkeys.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
            {passkeys.map((pk) => (
              <li key={pk.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-neutral-900 dark:text-neutral-100">
                  <Icon data={Key} size={14} className="shrink-0 text-neutral-500" />
                  <span className="truncate">{pk.name || 'Passkey'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deletePasskey(pk.id)}
                  aria-label={`Remove ${pk.name || 'passkey'}`}
                  className="rounded-lg p-1.5 text-danger transition hover:bg-danger/10"
                >
                  <Icon data={TrashBin} size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmTotp}
        onOpenChange={setConfirmTotp}
        title="Do you want to enable 2FA?"
        description="You will scan a QR code with an authenticator app and confirm with a 6-digit code. Afterwards you receive backup codes - store them safely, they are shown only once."
        confirmLabel="Yes, enable"
        cancelLabel="Not now"
        onConfirm={startTotpSetup}
      />

      <ConfirmDialog
        open={confirmPasskey}
        onOpenChange={setConfirmPasskey}
        title="Enable as Passkey?"
        description="Your browser will ask for fingerprint, face, PIN, or a security key. On first setup you also receive backup codes - store them safely, they are shown only once."
        confirmLabel="Yes, continue"
        cancelLabel="Not now"
        onConfirm={addPasskey}
      />
    </div>
  )
}
