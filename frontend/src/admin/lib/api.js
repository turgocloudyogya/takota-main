// API client for the Takota backend
//
// All API calls go directly to the real backend at the configured Base URL.
// Mock mode has been permanently disabled as the backend is ready.

import { getToken, setToken, clearSession } from './session.js'

const BASE_URL_KEY = 'takota_api_base_url'
const DEFAULT_BASE_URL = ''

export function getBaseUrl() {
  try {
    return localStorage.getItem(BASE_URL_KEY) || DEFAULT_BASE_URL
  } catch {
    return DEFAULT_BASE_URL
  }
}

export function setBaseUrl(url) {
  try {
    if (url) localStorage.setItem(BASE_URL_KEY, url.replace(/\/+$/, ''))
  } catch {
    // ignore
  }
}

// Mock mode permanently disabled - always return false
export function isMockMode() {
  return false
}

export function setMockMode() {
  console.warn('Mock Mode is permanently disabled. Backend API is used for all operations.')
}

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function buildQuery(params) {
  if (!params) return ''
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    usp.set(key, value)
  })
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

async function extractErrorMessage(response) {
  try {
    const data = await response.clone().json()
    return (
      data?.message ||
      data?.error ||
      data?.errors?.[0]?.message ||
      (typeof data === 'string' ? data : null) ||
      `Permintaan gagal (${response.status})`
    )
  } catch {
    try {
      const text = await response.text()
      return text || `Permintaan gagal (${response.status})`
    } catch {
      return `Permintaan gagal (${response.status})`
    }
  }
}

/**
 * Core request helper.
 */
async function request(path, { method = 'GET', params, body, auth = true, raw = false } = {}) {
  const url = `${getBaseUrl()}${path}${buildQuery(params)}`
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const headers = {
    'Key-Request': 'web',
  }
  if (!isForm) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      `Tidak dapat menghubungi server (${getBaseUrl()}). Periksa koneksi atau pastikan backend berjalan.`
    )
  }

  if (response.status === 401 || response.status === 403) {
    if (path !== '/api/auth') {
      clearSession()
    }
  }

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status)
  }

  if (raw) return response

  if (response.status === 204) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function pickToken(json) {
  return (
    json?.token ||
    json?.data?.token ||
    json?.access_token ||
    json?.data?.access_token ||
    json?.bearer ||
    json?.jwt ||
    (typeof json === 'string' ? json : null)
  )
}

export async function login(username, password) {
  const json = await request('/api/auth', {
    method: 'POST',
    auth: false,
    body: { username, password },
  })
  const token = pickToken(json)
  if (!token) {
    throw new ApiError('Login berhasil tetapi token tidak ditemukan pada respons server.')
  }
  setToken(token)
  return token
}

export function logout() {
  clearSession()
}

export async function changePassword({ currentPassword, newPassword, repeatPassword }) {
  return request('/api/auth-chpw', {
    method: 'POST',
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      repeat_password: repeatPassword,
    },
  })
}

// ---------------------------------------------------------------------------
// Admin — Users
// ---------------------------------------------------------------------------

export async function listUsers({ limit = 50, lastId = '', search = '' } = {}) {
  return request('/api/admin/users', { params: { limit, last_id: lastId, search } })
}

export async function createUser({ nickname, callname, type, username, password, changeAsLogin }) {
  return request('/api/admin/user', {
    method: 'POST',
    body: {
      nickname,
      callname,
      type,
      username,
      password,
      change_as_login: Boolean(changeAsLogin),
    },
  })
}

export async function updateUser(id, { nickname, callname, type, username, password, changeAsLogin }) {
  return request(`/api/admin/user/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: {
      nickname,
      callname,
      type,
      username,
      password,
      change_as_login: Boolean(changeAsLogin),
    },
  })
}

export async function deleteUser(id) {
  return request(`/api/admin/user/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Admin — Attendance
// ---------------------------------------------------------------------------

export async function listAttendance({ limit = 50, lastId = '', search = '' } = {}) {
  return request('/api/admin/attendances', { params: { limit, last_id: lastId, search } })
}

export async function deleteAttendance(id) {
  return request('/api/admin/attendance', { method: 'DELETE', body: { id } })
}

// ---------------------------------------------------------------------------
// Admin — Absence
// ---------------------------------------------------------------------------

export async function listAbsence({ limit = 50, lastId = '', search = '' } = {}) {
  return request('/api/admin/absences', { params: { limit, last_id: lastId, search } })
}

export async function signAbsence(id, sign) {
  return request('/api/admin/absence', { method: 'PATCH', body: { id, sign } })
}

export async function deleteAbsence(id) {
  return request(`/api/admin/absence/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Admin — Export
// ---------------------------------------------------------------------------

export async function exportAttendanceServer({ month, lang = 'id' } = {}) {
  const response = await request('/api/admin/export', {
    params: { month, lang },
    raw: true,
  })
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const filename = match?.[1] || `rekap-presensi-${month || 'export'}.csv`
  return { blob, filename }
}

// ---------------------------------------------------------------------------
// All (shared/global)
// ---------------------------------------------------------------------------

export async function globalInfo() {
  return request('/api/all/info')
}

export async function listPhotos({ limit = 50, lastId = '' } = {}) {
  return request('/api/all/photos', { params: { limit, last_id: lastId } })
}

export { ApiError }