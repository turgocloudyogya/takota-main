// API client for the Takota backend, wired to match the Bruno collection in
// Takota.zip (Admin / Auth / All / User folders).
//
// The docs only describe *requests* (method, url, body) — not response
// bodies — so every list/detail response is passed through the normalizers
// in `normalize.js`, which defensively look for a handful of likely field
// names. If your backend uses different field names than what's guessed
// here, that's the one file to adjust.

import { getToken, setToken, clearSession } from './session.js'
import * as mock from './mockData.js'

const BASE_URL_KEY = 'takota_api_base_url'
const DEFAULT_BASE_URL = 'http://localhost:8080'

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

// ---------------------------------------------------------------------------
// Preview / Mock mode
//
// The real Takota backend isn't running yet, so by default the admin
// dashboard runs against an in-memory mock backend (src/admin/lib/mockData.js)
// with realistic seed data, purely so the design and flows can be reviewed.
// Flip this off from Admin Login → Pengaturan once a real backend is
// reachable at the configured Base URL; every function below then goes back
// to calling the real HTTP API untouched.
// ---------------------------------------------------------------------------
const MOCK_MODE_KEY = 'takota_admin_mock_mode'

export function isMockMode() {
  try {
    const v = localStorage.getItem(MOCK_MODE_KEY)
    return v === null ? false : v === 'true'
  } catch {
    return false
  }
}

export function setMockMode(enabled) {
  try {
    localStorage.setItem(MOCK_MODE_KEY, enabled ? 'true' : 'false')
  } catch {
    // ignore
  }
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
 * @param {string} path - e.g. '/api/admin/users'
 * @param {object} options
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [options.method]
 * @param {object} [options.params] - query params
 * @param {object|FormData} [options.body]
 * @param {boolean} [options.auth] - attach bearer token (default true)
 * @param {boolean} [options.raw] - return the raw Response instead of parsed JSON
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
      `Tidak dapat menghubungi server (${getBaseUrl()}). Periksa koneksi atau alamat API di Pengaturan.`
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
  if (isMockMode()) {
    await mock.delay()
    const token = mock.loginMock(username, password)
    setToken(token)
    return token
  }

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
// Admin — Users (Siswa)
// ---------------------------------------------------------------------------

export async function listUsers({ limit = 50, lastId = '', search = '' } = {}) {
  if (isMockMode()) {
    await mock.delay()
    return mock.listUsersMock({ limit, lastId, search })
  }
  return request('/api/admin/users', { params: { limit, last_id: lastId, search } })
}

export async function createUser({ nickname, callname, type, username, password, changeAsLogin }) {
  if (isMockMode()) {
    await mock.delay()
    return mock.createUserMock({ nickname, callname, type, username, password, changeAsLogin })
  }
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
  if (isMockMode()) {
    await mock.delay()
    return mock.updateUserMock(id, { nickname, callname, type, username, password, changeAsLogin })
  }
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
  if (isMockMode()) {
    await mock.delay()
    return mock.deleteUserMock(id)
  }
  return request(`/api/admin/user/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Admin — Attendance (Presensi)
// ---------------------------------------------------------------------------

export async function listAttendance({ limit = 50, lastId = '', search = '' } = {}) {
  if (isMockMode()) {
    await mock.delay()
    return mock.listAttendanceMock({ limit, lastId, search })
  }
  return request('/api/admin/attendances', { params: { limit, last_id: lastId, search } })
}

export async function deleteAttendance(id) {
  if (isMockMode()) {
    await mock.delay()
    return mock.deleteAttendanceMock(id)
  }
  return request('/api/admin/attendance', { method: 'DELETE', body: { id } })
}

// ---------------------------------------------------------------------------
// Admin — Absence (Izin/Sakit)
// ---------------------------------------------------------------------------

export async function listAbsence({ limit = 50, lastId = '', search = '' } = {}) {
  if (isMockMode()) {
    await mock.delay()
    return mock.listAbsenceMock({ limit, lastId, search })
  }
  return request('/api/admin/absences', { params: { limit, last_id: lastId, search } })
}

/** sign: 'allow' | 'deny' */
export async function signAbsence(id, sign) {
  if (isMockMode()) {
    await mock.delay()
    return mock.signAbsenceMock(id, sign)
  }
  return request('/api/admin/absence', { method: 'PATCH', body: { id, sign } })
}

// ---------------------------------------------------------------------------
// Admin — server-side export (native endpoint from the docs)
// ---------------------------------------------------------------------------

/**
 * Downloads whatever file the backend's built-in export produces for a given
 * month. Returns { blob, filename }.
 */
export async function exportAttendanceServer({ month, lang = 'id' } = {}) {
  if (isMockMode()) {
    await mock.delay(600)
    return mock.exportAttendanceServerMock({ month, lang })
  }
  const response = await request('/api/admin/export', {
    params: { month, lang },
    raw: true,
  })
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const filename = match?.[1] || `rekap-presensi-${month || 'export'}.xlsx`
  return { blob, filename }
}

/**
 * Generates a PDF attendance recap from the server using absensi_template.html.
 * Returns { blob, filename }.
 * @param {object} params
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @param {string} [params.duName]
 * @param {string} [params.duAddress]
 * @param {string[]} [params.studentIds] - array of UUID strings
 */
export async function exportAttendancePDF({ startDate, endDate, duName = '', duAddress = '', studentIds = [] } = {}) {
  if (isMockMode()) {
    await mock.delay(800)
    return mock.exportAttendancePDFMock({ startDate, endDate })
  }
  const response = await request('/api/admin/export/pdf', {
    params: {
      start_date: startDate,
      end_date: endDate,
      du_name: duName || undefined,
      du_address: duAddress || undefined,
      student_ids: studentIds.length > 0 ? studentIds.join(',') : undefined,
    },
    raw: true,
  })
  const blob = await response.blob()
  const filename = `Rekap-Presensi_${startDate}_${endDate}.pdf`
  return { blob, filename }
}

// ---------------------------------------------------------------------------
// All (shared/global)
// ---------------------------------------------------------------------------

export async function globalInfo() {
  if (isMockMode()) {
    await mock.delay()
    return mock.globalInfoMock()
  }
  return request('/api/all/info')
}

export async function listPhotos({ limit = 50, lastId = '' } = {}) {
  if (isMockMode()) {
    await mock.delay()
    return mock.listPhotosMock({ limit, lastId })
  }
  return request('/api/all/photos', { params: { limit, last_id: lastId } })
}

export { ApiError }
