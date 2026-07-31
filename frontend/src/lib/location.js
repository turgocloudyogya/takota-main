// Real device location, reverse-geocoded into a human-readable
// "City, Regency" label (e.g. "Yogyakarta, Sleman") for the Today
// attendance card. Uses the browser Geolocation API + OpenStreetMap's
// free Nominatim reverse-geocoding endpoint — no API key required.

const REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse'

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function pickAddressParts(address = {}) {
  // Nominatim's address fields vary by country/region; fall back
  // through the most likely "city-ish" and "regency/state-ish" keys.
  const city =
    address.city ||
    address.town ||
    address.municipality ||
    address.village ||
    address.suburb
  const regency =
    address.county ||
    address.state_district ||
    address.regency ||
    address.state

  return [city, regency].filter(Boolean)
}

/**
 * Resolves the device's current position to a short location label.
 * Throws if the user denies permission, the browser has no geolocation
 * support, or the network/reverse-geocoding request fails.
 */
export async function getCurrentLocationLabel() {
  const position = await getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
  })

  const { latitude, longitude } = position.coords

  const url = `${REVERSE_GEOCODE_URL}?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Could not resolve your location.')
  }

  const data = await response.json()
  const parts = pickAddressParts(data.address)

  if (parts.length === 0) {
    // Still real coordinates — just no named place matched.
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
  }

  return parts.join(', ')
}
