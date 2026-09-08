// Route-level auth gate backed by GET /api/all/info.
//
// Auth uses the HttpOnly `takota_token` cookie (set by the backend at login),
// sent automatically via `credentials: "include"`. The backend's
// /api/all/info is the source of truth for whether the session is valid:
//   - session invalid  -> user lands on "/"
//   - session valid and user is on "/" -> redirected to data.redirect_home
//     (the backend returns "/main" for users and "/admin" for admins)
//   - network / parse problems  -> left alone (no forced logout)

import { clearAuthCookies, clearLegacyTokenStorage, getProfile } from './cookies.js'

const API_BASE =
  (typeof localStorage !== 'undefined' &&
    (localStorage.getItem('api-base-url') || localStorage.getItem('takota_api_base_url') || '')) ||
  ''

export function getSessionToken() {
  return null
}

export function getSessionProfile() {
  return getProfile()
}

export function clearSession() {
  clearAuthCookies()
  clearLegacyTokenStorage()
}

export async function checkAuth() {
  let response
  try {
    response = await fetch(`${API_BASE}/api/all/info`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'key-request': 'web-user',
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
    redirectHome: json.data.redirect_home || (json.data.role === 'admin' ? '/admin' : '/main'),
  }
}
