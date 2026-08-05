const PREFIX = 'takota-page-tip'

export function isPageTipDone(page) {
  try {
    return localStorage.getItem(`${PREFIX}-${page}`) === '1'
  } catch {
    return false
  }
}

export function markPageTipDone(page) {
  try {
    localStorage.setItem(`${PREFIX}-${page}`, '1')
  } catch (e) { void e }
}
