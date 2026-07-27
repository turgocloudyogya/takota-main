// API client for user pages (Main, Attendance, Absence, Photos)

const API_BASE = localStorage.getItem('api-base-url') || ''

function getToken() {
  try {
    // Try multiple token keys for compatibility
    return localStorage.getItem('takota_token') || 
           localStorage.getItem('takota_admin_token') || 
           localStorage.getItem('token') || 
           null
  } catch {
    return null
  }
}

function setToken(token) {
  try {
    localStorage.setItem('takota_token', token)
    // Also set admin token for compatibility
    localStorage.setItem('takota_admin_token', token)
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

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {
    'key-request': 'web-user',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    })
  } catch (err) {
    throw new ApiError(
      `Tidak dapat menghubungi server (${API_BASE}). Periksa koneksi.`,
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

export { setToken }

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
 */
export async function submitAbsence({ option, reason, file }) {
  const formData = new FormData()
  formData.append('option', option)
  formData.append('reason', reason)
  
  if (file) {
    formData.append('file', file)
  }

  return request('/api/user/absence', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
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

export { ApiError }
