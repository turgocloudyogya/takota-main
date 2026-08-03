/**
 * Download a file from a URL using fetch + blob to bypass CORS restrictions.
 * Creates a temporary blob URL and triggers the download.
 */
export async function downloadFile(url, filename) {
  if (!url) return

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || url.split('/').pop() || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
  } catch (error) {
    console.error('Download failed:', error)
    // Fallback: open in new tab if blob download fails
    window.open(url, '_blank')
  }
}
