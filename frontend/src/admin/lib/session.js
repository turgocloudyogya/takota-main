// Session/auth helpers for the admin dashboard.
//
// Takota's /api/auth login returns a bearer JWT. The token payload (see the
// example in the Bruno collection, opencollection.yml -> EX_AUTHBEARER)
// looks like:
//   { user_id, username, type, auth_id, change_as_login, exp, nbf, iat }
//
// "type" is what distinguishes an admin account ("admin") from a regular
// student/user account ("user"). We decode it client-side (no signature
// verification - that's the backend's job) purely to know who is logged in
// and to gate the /admin/* routes to admin accounts.

const TOKEN_KEY = 'takota_admin_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore storage failures (e.g. private browsing) - session just won't persist.
  }
}

export function clearSession() {
  setToken(null)
  // The login flow stores the token under multiple keys; clearing only
  // takota_admin_token lets AuthGate find the still-valid token via
  // takota_token and bounce the user back in (logout loop). Remove them all.
  const legacyKeys = ['takota_token', 'token', 'takota-username', 'takota-role']
  for (const key of legacyKeys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore storage failures
    }
  }
}

/**
 * Decodes a JWT payload without verifying the signature. Returns null if the
 * token is missing or malformed.
 */
export function decodeToken(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getSession() {
  const token = getToken()
  const claims = decodeToken(token)
  if (!token || !claims) return null

  if (claims.exp && Date.now() / 1000 > claims.exp) {
    return null
  }

  return {
    token,
    userId: claims.user_id,
    username: claims.username,
    type: claims.type,
    changeAsLogin: Boolean(claims.change_as_login),
  }
}

export function isAdminSession(session) {
  return Boolean(session && session.type === 'admin')
}
