// API client for user pages (Main, Attendance, Absence, Photos)
//
// Auth uses the HttpOnly `takota_token` cookie set by the backend at login.
// Every request sends `credentials: "include"` so the browser attaches it
// automatically (same-origin via nginx in Docker, via vite proxy in dev).
// No token is ever stored in JS or localStorage.

import { clearSession } from './authGate.js'

const API_BASE = localStorage.getItem('api-base-url') || ''

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {
    'key-request': 'web-user',
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      `Cannot reach the server (${API_BASE}). Please check your connection.`,
      0
    )
  }

  if (!response.ok) {
    let errorMsg
    try {
      const data = await response.json()
      // Handle nested error object from backend
      if (data.error && typeof data.error === 'object') {
        errorMsg = data.error.message || data.error.error || JSON.stringify(data.error)
      } else {
        errorMsg = data.message || data.error || `Request failed (${response.status})`
      }
    } catch {
      errorMsg = `Request failed (${response.status})`
    }
    throw new ApiError(errorMsg, response.status)
  }

  if (response.status === 204) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
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

// ---------------------------------------------------------------------------
// User API Endpoints
// ---------------------------------------------------------------------------

/**
 * Get user home/dashboard data
 * GET /api/user/home
 */
export async function getUserHome() {
  return request('/api/user/home')
}

/**
 * Submit attendance with photo and location
 * POST /api/user/attendance
 * 
 * @param {Object} data
 * @param {string} data.latitude - GPS latitude
 * @param {string} data.longitude - GPS longitude
 * @param {File} [data.photo] - Optional photo file
 */
export async function submitAttendance({ latitude, longitude, photo }) {
  const formData = new FormData()
  formData.append('latitude', latitude)
  formData.append('longitude', longitude)
  
  if (photo) {
    formData.append('photo', photo)
  }

  return request('/api/user/attendance', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

/**
 * Submit absence/leave request
 * POST /api/user/absence
 *
 * @param {Object} data
 * @param {string} data.option - 'sick' or 'permission'
 * @param {string} data.reason - Reason for absence
 * @param {File} [data.file] - Optional supporting document
 * @param {string} [data.absence_start_date] - Optional start date (YYYY-MM-DD) for multi-day absence
 * @param {string} [data.absence_end_date] - Optional end date (YYYY-MM-DD) for multi-day absence
 */
export async function submitAbsence({ option, reason, file, absence_start_date, absence_end_date }) {
  const formData = new FormData()
  formData.append('option', option)
  formData.append('reason', reason)

  if (file) {
    formData.append('file', file)
  }

  if (absence_start_date) {
    formData.append('absence_start_date', absence_start_date)
  }

  if (absence_end_date) {
    formData.append('absence_end_date', absence_end_date)
  }

  return request('/api/user/absence', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

/**
 * Delete one of the user's own pending absence requests
 * DELETE /api/user/absence/:absenceId
 */
export async function deleteAbsence(absenceId) {
  return request(`/api/user/absence/${absenceId}`, { method: 'DELETE' })
}

/**
 * Get photos gallery
 * GET /api/all/photos
 */
export async function getPhotos({ limit = 50, lastId = '' } = {}) {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit)
  if (lastId) params.set('last_id', lastId)
  
  const query = params.toString()
  return request(`/api/all/photos${query ? '?' + query : ''}`)
}

/**
 * Get personal activity heatmap (own days only).
 * GET /api/user/dashboard/activity
 */
export async function getUserActivity({ days = 150 } = {}) {
  const params = new URLSearchParams({ days: String(days) })
  return request(`/api/user/dashboard/activity?${params.toString()}`)
}

/**
 * Get attendance settings status (open/closed + hours + days).
 * Public to any authenticated user for countdown UIs.
 * GET /api/all/settings/status
 */
export async function getSettings() {
  return request('/api/all/settings/status')
}

export { ApiError }
