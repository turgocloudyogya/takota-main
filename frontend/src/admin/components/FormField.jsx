import { useState } from 'react'
import { Icon } from '@gravity-ui/uikit'
import { Eye, EyeSlash } from '@gravity-ui/icons'

// Matches the visual language already used in src/pages/Login.jsx
// (rounded-xl bg-neutral-50 label wrapper around a bare <input>).

export function TextInput({ label, className = '', ...inputProps }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-neutral-600">{label}</span>}
      <input
        className="w-full rounded-xl border border-transparent bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral focus:border-primary/40"
        {...inputProps}
      />
    </label>
  )
}

export function PasswordInput({ label, className = '', ...inputProps }) {
  const [show, setShow] = useState(false)
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-neutral-600">{label}</span>}
      <span className="flex items-center gap-2 rounded-xl border border-transparent bg-neutral-50 px-3.5 py-2.5 focus-within:border-primary/40">
        <input
          type={show ? 'text' : 'password'}
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
          className="shrink-0 text-neutral"
        >
          <Icon data={show ? EyeSlash : Eye} size={16} />
        </button>
      </span>
    </label>
  )
}

export function SelectInput({ label, className = '', children, ...selectProps }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-neutral-600">{label}</span>}
      <select
        className="w-full rounded-xl border border-transparent bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:border-primary/40"
        {...selectProps}
      >
        {children}
      </select>
    </label>
  )
}

export function ToggleField({ label, checked, onChange, className = '' }) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 ${className}`}>
      <span className="text-sm text-neutral-900">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  )
}
