// Route-level auth gate backed by GET /api/all/info.
//
// The backend's /api/all/info is the source of truth for whether the JWT is
// still valid. On every route change the gate re-checks it (no polling):
//   - token missing / invalid  -> session cleared, user lands on "/"
//   - token valid and user is on "/" -> redirected to data.redirect_home
//     (the backend returns "/main" for users and "/dash" for admins)
//   - network / parse problems  -> left alone (no forced logout)

const API_BASE =
  (typeof localStorage !== 'undefined' &&
    (localStorage.getItem('api-base-url') || localStorage.getItem('takota_api_base_url') || '')) ||
  ''

const TOKEN_KEYS = ['takota_token', 'takota_admin_token', 'token']

export function getSessionToken() {
  if (typeof localStorage === 'undefined') return null
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key)
    if (value) return value
  }
  return null
}

export function clearSession() {
  if (typeof localStorage === 'undefined') return
  for (const key of TOKEN_KEYS) localStorage.removeItem(key)
  localStorage.removeItem('takota-username')
  localStorage.removeItem('takota-role')
}

export async function checkAuth() {
  const token = getSessionToken()
  if (!token) return { valid: false, reason: 'no-token' }

  let response
  try {
    response = await fetch(`${API_BASE}/api/all/info`, {
      headers: {
        'Content-Type': 'application/json',
        'key-request': 'web-user',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    return { valid: 'unknown', reason: 'network' }
  }

  if (response.status === 401 || response.status === 403) {
    return { valid: false, reason: 'unauthorized' }
  }

  let json
  try {
    json = await response.json()
  } catch {
    return { valid: 'unknown', reason: 'unparseable' }
  }

  if (!json || json.unvalid || !json.data) {
    return { valid: false, reason: 'unvalid' }
  }

  return {
    valid: true,
    role: json.data.role,
    redirectHome: json.data.redirect_home || (json.data.role === 'admin' ? '/dash' : '/main'),
  }
}
