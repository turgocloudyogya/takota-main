// Server-time helpers for countdown UIs.
//
// The backend runs in TIMEZONE_APP (e.g. Asia/Jakarta) while the client can
// be anywhere (e.g. Asia/Tokyo). All open/close math must use the server
// clock, so we measure the offset between server `now` and the device clock
// once per settings fetch and shift every later computation by it. Absolute
// datetimes (next_open, close_at) need no timezone math at all.

export function serverDelta(settings) {
  if (!settings?.now) return 0
  const t = new Date(settings.now).getTime()
  if (Number.isNaN(t)) return 0
  return t - Date.now()
}

export function serverNow(delta) {
  return new Date(Date.now() + (delta || 0))
}

export function parseAbsolute(value) {
  if (!value) return null
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t)
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  return `${hours}h ${minutes}m ${seconds}s`
}
