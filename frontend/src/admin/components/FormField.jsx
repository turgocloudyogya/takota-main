import { useState } from 'react'
import { Icon } from '@gravity-ui/uikit'
import { Eye, EyeSlash } from '@gravity-ui/icons'

// Matches the visual language already used in src/pages/Login.jsx
// (rounded-xl bg-neutral-50 label wrapper around a bare <input>).

export function TextInput({ label, className = '', ...inputProps }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</span>}
      <input
        className="w-full rounded-xl border border-transparent bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral focus:border-primary/40 dark:bg-neutral-800/60 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        {...inputProps}
      />
    </label>
  )
}

export function PasswordInput({ label, className = '', ...inputProps }) {
  const [show, setShow] = useState(false)
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</span>}
      <span className="flex items-center gap-2 rounded-xl border border-transparent bg-neutral-50 px-3.5 py-2.5 focus-within:border-primary/40 dark:bg-neutral-800/60">
        <input
          type={show ? 'text' : 'password'}
          className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral dark:text-neutral-100 dark:placeholder:text-neutral-500"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="shrink-0 text-neutral dark:text-neutral-400"
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
      {label && <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</span>}
      <select
        className="w-full rounded-xl border border-transparent bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:border-primary/40 dark:bg-neutral-800/60 dark:text-neutral-100"
        {...selectProps}
      >
        {children}
      </select>
    </label>
  )
}
