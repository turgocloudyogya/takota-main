const GUIDE_KEY = 'takota-admin-guide-done'

export function isGuideDone() {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuideDone() {
  try {
    localStorage.setItem(GUIDE_KEY, '1')
  } catch (e) { void e }
}
