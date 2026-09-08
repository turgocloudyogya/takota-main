// Cookie helpers for auth session.
//
// The JWT itself lives in the HttpOnly `takota_token` cookie set by the
// backend at login (JS cannot read it - that is the point). The browser
// attaches it automatically when fetch uses `credentials: "include"`, which
// also works behind the nginx proxy in Docker with no extra config.
//
// Only non-sensitive UI hints (role/username from `takota_profile`) are read
// here for route gating; the backend remains the source of truth.

export function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!match) return null
  try {
    return decodeURIComponent(match.slice(name.length + 1))
  } catch {
    return null
  }
}

export function deleteCookie(name) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}

export function getProfile() {
  const raw = getCookie('takota_profile')
  if (!raw) return null
  const sep = raw.indexOf('|')
  if (sep < 0) return null
  return { username: raw.slice(0, sep), role: raw.slice(sep + 1) }
}

export function clearAuthCookies() {
  deleteCookie('takota_token')
  deleteCookie('takota_profile')
}

// Remove legacy localStorage token keys from before the cookie migration.
export function clearLegacyTokenStorage() {
  if (typeof localStorage === 'undefined') return
  for (const key of ['takota_token', 'takota_admin_token', 'token', 'takota-username', 'takota-role']) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}
