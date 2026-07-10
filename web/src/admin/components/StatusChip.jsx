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

// Attendance mark chip (V = hadir, S = sakit, I = izin, A = alpha)
const MARK_CONFIG = {
  V: { label: 'Hadir', color: 'success' },
  S: { label: 'Sakit', color: 'warning' },
  I: { label: 'Izin', color: 'accent' },
  A: { label: 'Alpha', color: 'danger' },
}

export function MarkChip({ mark, size = 'sm' }) {
  if (!mark) {
    return <span className="text-xs text-neutral">—</span>
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
  allow: { label: 'Disetujui', color: 'success' },
  approved: { label: 'Disetujui', color: 'success' },
  deny: { label: 'Ditolak', color: 'danger' },
  rejected: { label: 'Ditolak', color: 'danger' },
  pending: { label: 'Menunggu', color: 'warning' },
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

// Sakit/Izin reason-type chip
export function OptionChip({ isSick, size = 'sm' }) {
  return (
    <DotChip color={isSick ? 'warning' : 'accent'} size={size}>
      {isSick ? 'Sakit' : 'Izin'}
    </DotChip>
  )
}

// User type chip (admin / siswa)
export function TypeChip({ type, size = 'sm' }) {
  const isAdmin = type === 'admin'
  return (
    <DotChip color={isAdmin ? 'accent' : 'default'} size={size}>
      {isAdmin ? 'Admin' : 'Siswa'}
    </DotChip>
  )
}
