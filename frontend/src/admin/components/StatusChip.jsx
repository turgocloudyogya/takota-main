import { Chip } from '@heroui/react'

const DOT_TONE = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-primary',
  default: 'bg-neutral',
}

function DotChip({ color = 'default', size = 'sm', children }) {
  return (
    <Chip color={color} variant="soft" size={size}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[color] || DOT_TONE.default}`} aria-hidden="true" />
      {children}
    </Chip>
  )
}

// Attendance mark chip (V = present, S = sick, I = leave, A = alpha)
const MARK_CONFIG = {
  V: { label: 'Present', color: 'success' },
  S: { label: 'Sick', color: 'warning' },
  I: { label: 'Leave', color: 'accent' },
  A: { label: 'Alpha', color: 'danger' },
}

export function MarkChip({ mark, size = 'sm' }) {
  if (!mark) {
    return <span className="text-xs text-neutral dark:text-neutral-400">-</span>
  }
  const config = MARK_CONFIG[mark] || { label: mark, color: 'default' }
  return (
    <DotChip color={config.color} size={size}>
      {mark}
    </DotChip>
  )
}

// Absence sign/status chip (pending / allow / deny)
const SIGN_CONFIG = {
  allow: { label: 'Approved', color: 'success' },
  approved: { label: 'Approved', color: 'success' },
  deny: { label: 'Rejected', color: 'danger' },
  reject: { label: 'Rejected', color: 'danger' },
  rejected: { label: 'Rejected', color: 'danger' },
  pending: { label: 'Pending', color: 'warning' },
}

export function SignChip({ sign, size = 'sm' }) {
  const key = String(sign || 'pending').toLowerCase()
  const config = SIGN_CONFIG[key] || { label: key, color: 'default' }
  return (
    <DotChip color={config.color} size={size}>
      {config.label}
    </DotChip>
  )
}

// Sick/Leave reason-type chip
export function OptionChip({ isSick, size = 'sm' }) {
  return (
    <DotChip color={isSick ? 'warning' : 'accent'} size={size}>
      {isSick ? 'Sick' : 'Leave'}
    </DotChip>
  )
}

// User type chip (admin / student)
export function TypeChip({ type, size = 'sm' }) {
  const isAdmin = type === 'admin'
  return (
    <DotChip color={isAdmin ? 'accent' : 'default'} size={size}>
      {isAdmin ? 'Admin' : 'Student'}
    </DotChip>
  )
}
