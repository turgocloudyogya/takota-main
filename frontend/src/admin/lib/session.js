// Session/auth helpers for the admin dashboard.
//
// Auth uses the HttpOnly `takota_token` cookie (set by the backend at login,
// sent automatically with `credentials: "include"`). JS never sees the JWT;
// route gating reads only the non-sensitive `takota_profile` cookie
// ("username|role"). The backend remains the source of truth — an invalid or
// expired session is bounced to login by AuthGate via GET /api/all/info.

import { getProfile, clearAuthCookies, clearLegacyTokenStorage } from '../../lib/cookies.js'

const TOKEN_KEY = 'takota_admin_token'

export function getToken() {
  return null
}

export function setToken() {
  // No-op: tokens live in the HttpOnly cookie now.
}

export function clearSession() {
  clearAuthCookies()
  clearLegacyTokenStorage()
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore storage failures
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
  const profile = getProfile()
  if (!profile) return null

  return {
    token: null,
    userId: null,
    username: profile.username,
    type: profile.role,
    changeAsLogin: false,
  }
}

export function isAdminSession(session) {
  return Boolean(session && session.type === 'admin')
}
