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
    if (data && typeof data === 'object') {
      // Backend error envelope: { error: { status, message, code } }
      if (data.error && typeof data.error === 'object') {
        return (
          data.error.message ||
          data.error.code ||
          `Request failed (${response.status})`
        )
      }
      // Validation errors list: { errors: [{ message }] }
      if (Array.isArray(data.errors) && data.errors.length) {
        const first = data.errors[0]
        if (first && typeof first === 'object') {
          return first.message || JSON.stringify(first)
        }
        return String(first)
      }
      if (typeof data.message === 'string') return data.message
      if (typeof data.error === 'string') return data.error
    }
    if (typeof data === 'string') return data
    return `Request failed (${response.status})`
  } catch {
    try {
      const text = await response.text()
      return text || `Request failed (${response.status})`
    } catch {
      return `Request failed (${response.status})`
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
      `Cannot reach the server (${getBaseUrl()}). Check your connection or make sure the backend is running.`
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
    throw new ApiError('Login succeeded but no token was found in the server response.')
  }
  setToken(token)
  return token
}

export async function logout() {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } catch {
    // Best-effort: even if the server is unreachable, always clear the local
    // session so the user isn't locked in a logout loop.
  } finally {
    clearSession()
  }
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
// Admin - Users
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
// Admin - Attendance
// ---------------------------------------------------------------------------

export async function listAttendance({ limit = 50, lastId = '', search = '' } = {}) {
  return request('/api/admin/attendances', { params: { limit, last_id: lastId, search } })
}

export async function deleteAttendance(id) {
  return request('/api/admin/attendance', { method: 'DELETE', body: { id } })
}

// ---------------------------------------------------------------------------
// Admin - Absence
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
// Admin - Export
// ---------------------------------------------------------------------------

export async function exportAttendanceServer({ month, year, lang = 'en' } = {}) {
  const response = await request('/api/admin/export', {
    params: { month, year, lang },
    raw: true,
  })
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const filename = match?.[1] || `attendance-report-${month || 'export'}.csv`
  return { blob, filename }
}

// Fetches the assembled attendance recap (Doc/Pages/Blocks/Siswa structure)
// used to render the PDF client-side via attendanceReportHtml.js. Mirrors
// takota-app's GET /api/admin/export/report-data endpoint.
export async function fetchAttendanceReportData({
  startDate,
  endDate,
  duName = '',
  duAddress = '',
  studentIds = [],
  // Which weekdays count as "work days" for the recap, using JS
  // Date#getDay() numbering (0=Minggu..6=Sabtu). Defaults to Senin-Sabtu on
  // the backend when omitted.
  workDays = [],
} = {}) {
  const response = await request('/api/admin/export/report-data', {
    params: {
      start_date: startDate,
      end_date: endDate,
      du_name: duName || undefined,
      du_address: duAddress || undefined,
      student_ids: studentIds.length > 0 ? studentIds.join(',') : undefined,
      work_days: workDays.length > 0 ? workDays.join(',') : undefined,
    },
  })

  // Backend returns PDFTemplateData directly ({ pages: [...] }), but handle
  // a possible wrapped shape defensively too.
  if (response?.pages) return response
  if (response?.data?.pages) return response.data
  if (response?.data) return response.data
  return response
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