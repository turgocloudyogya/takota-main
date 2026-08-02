// The API docs (Takota.zip) only specify request shapes, not response
// bodies. These helpers normalize whatever the backend actually returns into
// a predictable shape the UI can rely on, trying a handful of common field
// names before giving up. Centralizing the guesswork here means that if the
// real backend uses different field names, this is the only file to fix.

/** Pulls the array of records out of a list response, whatever it's wrapped in. */
export function unwrapList(json, ...keys) {
  if (Array.isArray(json)) return json
  if (!json || typeof json !== 'object') return []
  for (const key of keys) {
    if (Array.isArray(json[key])) return json[key]
  }
  if (Array.isArray(json.data)) return json.data
  if (Array.isArray(json.items)) return json.items
  if (Array.isArray(json.results)) return json.results
  if (json.data && typeof json.data === 'object') {
    for (const key of keys) {
      if (Array.isArray(json.data[key])) return json.data[key]
    }
    if (Array.isArray(json.data.items)) return json.data.items
  }
  return []
}

/** Pulls the pagination cursor (last_id) out of a list response. */
export function unwrapCursor(json) {
  if (!json || typeof json !== 'object') return ''
  return (
    json.last_id ??
    json.next_id ??
    json.cursor ??
    json.meta?.last_id ??
    json.data?.last_id ??
    ''
  )
}

function firstDefined(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

export function normalizeUser(raw) {
  if (!raw) return null
  return {
    id: firstDefined(raw.id, raw._id, raw.uuid, raw.user_id),
    username: firstDefined(raw.username, raw.user?.username),
    nickname: firstDefined(raw.nickname, raw.name, raw.user?.nickname, raw.callname),
    callname: firstDefined(raw.callname, raw.nickname),
    type: firstDefined(raw.type, raw.role, 'user'),
    changeAsLogin: Boolean(raw.change_as_login),
    createdAt: firstDefined(raw.created_at, raw.createdAt),
    raw,
  }
}

export function normalizeAttendance(raw) {
  if (!raw) return null
  const dateRaw = firstDefined(
    raw.date,
    raw.attendance_date,
    raw.created_at,
    raw.createdAt,
    raw.timestamp,
    raw.time
  )
  return {
    id: firstDefined(raw.id, raw._id, raw.uuid),
    userId: firstDefined(raw.user_id, raw.userId, raw.user?.id),
    name: firstDefined(
      raw.nickname,
      raw.name,
      raw.user?.name,
      raw.user?.nickname,
      raw.callname,
      raw.username,
      raw.user?.username
    ),
    username: firstDefined(raw.username, raw.user?.username),
    dateRaw,
    latitude: firstDefined(raw.latitude, raw.lat),
    longitude: firstDefined(raw.longitude, raw.lng, raw.long),
    location: firstDefined(raw.location, raw.address),
    displayAddress: firstDefined(raw.display_address, raw.displayAddress),
    mapsUrl:
      firstDefined(raw.gmaps_embed, raw.gmaps_url, raw.maps_url) ||
      (raw.latitude && raw.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${raw.latitude},${raw.longitude}`
        : ''),
    photoUrl: firstDefined(raw.photo, raw.photo_url, raw.image, raw.file),
    raw,
  }
}

const SICK_OPTIONS = new Set(['sick', 'sakit'])

export function normalizeAbsence(raw) {
  if (!raw) return null
  const dateRaw = firstDefined(
    raw.date,
    raw.absence_date,
    raw.created_at,
    raw.createdAt,
    raw.timestamp
  )
  const option = firstDefined(raw.option, raw.type, raw.reason_option, 'permit')
  // Check verify.sign_status first, then fallback to raw.sign or raw.status
  const sign = firstDefined(
    raw.verify?.sign_status,
    raw.sign_status,
    raw.sign,
    raw.status,
    'pending'
  )
  return {
    id: firstDefined(raw.id, raw._id, raw.uuid),
    userId: firstDefined(raw.user_id, raw.userId, raw.user?.id),
    name: firstDefined(
      raw.nickname,
      raw.name,
      raw.user?.name,
      raw.user?.nickname,
      raw.callname,
      raw.username,
      raw.user?.username
    ),
    username: firstDefined(raw.username, raw.user?.username),
    dateRaw,
    reason: firstDefined(raw.reason, raw.description),
    option,
    isSick: SICK_OPTIONS.has(String(option).toLowerCase()),
    sign: sign ? String(sign).toLowerCase() : 'pending',
    fileUrl: firstDefined(raw.file, raw.file_url, raw.attachment, raw.photo),
    raw,
  }
}

export function normalizePhoto(raw) {
  if (!raw) return null
  return {
    id: firstDefined(raw.id, raw._id, raw.uuid),
    url: firstDefined(raw.url, raw.photo, raw.photo_url, raw.image),
    date: firstDefined(raw.date, raw.created_at, raw.createdAt),
    time: raw.time,
    username: firstDefined(raw.username, raw.user?.username, raw.nickname),
    raw,
  }
}
