// In-memory mock backend for the Takota admin dashboard.
//
// The real Takota backend isn't running yet, so this module stands in for
// it: seeded, realistic-looking data (students, attendance check-ins,
// izin/sakit submissions, photos) plus the same list/create/update/delete
// operations the real API would do, all kept in memory for the session.
//
// This is ONLY used when "Preview mode" is on (see isMockMode() in api.js).
// Turn it off in Admin Login → Pengaturan once the real backend is ready,
// and the dashboard goes back to calling the actual HTTP API untouched.

// ---------------------------------------------------------------------------
// Small deterministic PRNG so the seed data looks the same every reload
// instead of jumping around.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260709)
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)]
}
function chance(p) {
  return rand() < p
}

export function delay(ms = 380) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// JWT-shaped (but unsigned) token so session.js's decodeToken() works as-is.
// ---------------------------------------------------------------------------
function base64UrlEncode(obj) {
  const json = JSON.stringify(obj)
  const utf8 = unescape(encodeURIComponent(json))
  const b64 = btoa(utf8)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createToken(claims) {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' })
  const payload = base64UrlEncode(claims)
  return `${header}.${payload}.preview`
}

// ---------------------------------------------------------------------------
// Seed: Students (siswa PKL/prakerin)
// ---------------------------------------------------------------------------
const STUDENT_SEED = [
  ['Ahnaf', 'Ahnaf Farras Ramadhan', 'Ahnaffarras'],
  ['Rafi', 'Rafi Fadhilah', 'RafiFadhilah'],
  ['Wirawan', 'Wirawan Yogiyanto', 'WirawanY'],
  ['Citra', 'Citra Ayu Lestari', 'CitraAyu'],
  ['Bagas', 'Bagas Setiawan', 'BagasSetiawan'],
  ['Dewi', 'Dewi Anggraini', 'DewiAnggraini'],
]

let studentSeq = 0
function nextId(prefix, seq) {
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

function makeStudent([nickname, callname, username]) {
  studentSeq += 1
  return {
    id: nextId('usr', studentSeq),
    nickname,
    callname,
    username: username.toLowerCase(),
    password: 'siswa123', // preview-only, never used for real auth
    type: 'user',
    change_as_login: false,
    created_at: new Date(2026, 5, 1 + (studentSeq % 20)).toISOString(),
  }
}

const ADMIN_SEED = [
  {
    id: 'usr-admin-1',
    nickname: 'Admin Takota',
    callname: 'Admin Takota',
    username: 'admin',
    password: 'admin123',
    type: 'admin',
    change_as_login: false,
    created_at: new Date(2026, 4, 20).toISOString(),
  },
  {
    id: 'usr-admin-2',
    nickname: 'Bu Siti Rahayu',
    callname: 'Siti Rahayu, S.Pd.',
    username: 'sitirahayu',
    password: 'admin123',
    type: 'admin',
    change_as_login: false,
    created_at: new Date(2026, 4, 20).toISOString(),
  },
]

// Mutable store — lives for the lifetime of the tab (resets on full reload).
export const store = {
  users: [...ADMIN_SEED, ...STUDENT_SEED.map(makeStudent)],
  attendance: [],
  absence: [],
  photos: [],
}

// ---------------------------------------------------------------------------
// Seed: Attendance check-ins over the last ~20 days (Mon–Sat only)
// ---------------------------------------------------------------------------
const LOCATIONS = [
  { label: 'Kantor DU/DI - Jl. Malioboro No. 12, Yogyakarta', lat: -7.7928, lng: 110.3656 },
  { label: 'Bengkel Mitra - Jl. Kaliurang KM 5, Yogyakarta', lat: -7.7433, lng: 110.3789 },
  { label: 'Kantor Cabang - Jl. Gejayan, Yogyakarta', lat: -7.7715, lng: 110.3889 },
]

function workdaysBack(count) {
  const days = []
  const cursor = new Date()
  cursor.setHours(8, 0, 0, 0)
  while (days.length < count) {
    if (cursor.getDay() !== 0) days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() - 1)
  }
  return days.reverse()
}

const students = () => store.users.filter((u) => u.type !== 'admin')

let attSeq = 0
let absSeq = 0

function seedAttendanceAndAbsence() {
  const days = workdaysBack(18)
  const roster = students()

  days.forEach((day) => {
    roster.forEach((student) => {
      const loc = pick(LOCATIONS)
      const hour = 6 + Math.floor(rand() * 2)
      const minute = Math.floor(rand() * 60)
      const checkIn = new Date(day)
      checkIn.setHours(hour, minute, 0, 0)

      if (chance(0.72)) {
        attSeq += 1
        store.attendance.push({
          id: nextId('att', attSeq),
          user_id: student.id,
          nickname: student.nickname,
          username: student.username,
          date: checkIn.toISOString(),
          latitude: loc.lat + (rand() - 0.5) * 0.01,
          longitude: loc.lng + (rand() - 0.5) * 0.01,
          location: loc.label,
          photo: `https://picsum.photos/seed/${student.username}-${checkIn.getDate()}/480`,
        })
      } else if (chance(0.55)) {
        // Sick/permit submission for that day
        absSeq += 1
        const isSick = chance(0.5)
        const signRoll = rand()
        const sign = signRoll < 0.55 ? 'allow' : signRoll < 0.8 ? 'pending' : 'deny'
        store.absence.push({
          id: nextId('abs', absSeq),
          user_id: student.id,
          nickname: student.nickname,
          username: student.username,
          date: checkIn.toISOString(),
          option: isSick ? 'sick' : 'permit',
          reason: isSick
            ? pick(['Sakit demam', 'Sakit flu dan batuk', 'Sakit maag', 'Kontrol ke dokter'])
            : pick(['Acara keluarga', 'Urusan administrasi sekolah', 'Kepentingan keluarga', 'Izin acara pernikahan saudara']),
          sign,
          file: chance(0.6) ? `https://picsum.photos/seed/${student.username}-surat-${absSeq}/400` : null,
        })
      }
      // else: no record for that day -> counted as "alpha" automatically,
      // same as the real recap logic (see csvTemplate.js).
    })
  })

  // Newest first, matching how a real cursor-paginated feed would read.
  store.attendance.sort((a, b) => new Date(b.date) - new Date(a.date))
  store.absence.sort((a, b) => new Date(b.date) - new Date(a.date))
}

seedAttendanceAndAbsence()

// ---------------------------------------------------------------------------
// Seed: Photo gallery (/api/all/photos)
// ---------------------------------------------------------------------------
store.photos = store.attendance.slice(0, 24).map((row, i) => ({
  id: nextId('ph', i + 1),
  url: row.photo,
  photo_url: row.photo,
  date: row.date,
  username: row.username,
}))

// ---------------------------------------------------------------------------
// Pagination + search helpers
// ---------------------------------------------------------------------------
function paginate(list, { limit = 50, lastId = '' } = {}) {
  let start = 0
  if (lastId) {
    const idx = list.findIndex((item) => item.id === lastId)
    start = idx >= 0 ? idx + 1 : 0
  }
  return list.slice(start, start + Number(limit))
}

function matchesSearch(record, term) {
  if (!term) return true
  const t = term.toLowerCase()
  return (
    record.nickname?.toLowerCase().includes(t) ||
    record.callname?.toLowerCase().includes(t) ||
    record.username?.toLowerCase().includes(t)
  )
}

// ---------------------------------------------------------------------------
// Public mock operations — mirror api.js's real functions 1:1.
// ---------------------------------------------------------------------------

export function loginMock(username, password) {
  const match = store.users.find(
    (u) => u.username.toLowerCase() === String(username).trim().toLowerCase() && u.password === password
  )
  if (!match) {
    throw new Error(
      'Username atau password salah. Mode Pratinjau: gunakan admin / admin123, atau nonaktifkan Mode Pratinjau di Pengaturan untuk memakai backend asli.'
    )
  }
  const now = Math.floor(Date.now() / 1000)
  return createToken({
    user_id: match.id,
    username: match.username,
    type: match.type,
    auth_id: `preview-${match.id}`,
    change_as_login: Boolean(match.change_as_login),
    iat: now,
    nbf: now,
    exp: now + 60 * 60 * 12, // 12h
  })
}

export function listUsersMock({ limit, lastId, search } = {}) {
  const filtered = store.users
    .filter((u) => matchesSearch(u, search))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
  const page = paginate(filtered, { limit, lastId })
  return { users: page, last_id: page.length ? page[page.length - 1].id : lastId || '' }
}

export function createUserMock({ nickname, callname, type, username, password, changeAsLogin }) {
  if (store.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username sudah digunakan.')
  }
  studentSeq += 1
  const record = {
    id: nextId('usr', studentSeq),
    nickname,
    callname: callname || nickname,
    username,
    password: password || 'changeme',
    type: type || 'user',
    change_as_login: Boolean(changeAsLogin),
    created_at: new Date().toISOString(),
  }
  store.users.push(record)
  return { user: record }
}

export function updateUserMock(id, { nickname, callname, type, username, password, changeAsLogin }) {
  const record = store.users.find((u) => u.id === id)
  if (!record) throw new Error('Akun tidak ditemukan.')
  if (nickname) record.nickname = nickname
  if (callname) record.callname = callname
  if (type) record.type = type
  if (username) record.username = username
  if (password) record.password = password
  record.change_as_login = Boolean(changeAsLogin)
  return { user: record }
}

export function deleteUserMock(id) {
  const idx = store.users.findIndex((u) => u.id === id)
  if (idx === -1) throw new Error('Akun tidak ditemukan.')
  store.users.splice(idx, 1)
  return { success: true }
}

export function listAttendanceMock({ limit, lastId, search } = {}) {
  const filtered = store.attendance.filter((a) => matchesSearch(a, search))
  const page = paginate(filtered, { limit, lastId })
  return { attendances: page, last_id: page.length ? page[page.length - 1].id : lastId || '' }
}

export function deleteAttendanceMock(id) {
  const idx = store.attendance.findIndex((a) => a.id === id)
  if (idx === -1) throw new Error('Data presensi tidak ditemukan.')
  store.attendance.splice(idx, 1)
  return { success: true }
}

export function listAbsenceMock({ limit, lastId, search } = {}) {
  const filtered = store.absence.filter((a) => matchesSearch(a, search))
  const page = paginate(filtered, { limit, lastId })
  return { absences: page, last_id: page.length ? page[page.length - 1].id : lastId || '' }
}

export function signAbsenceMock(id, sign) {
  const record = store.absence.find((a) => a.id === id)
  if (!record) throw new Error('Pengajuan tidak ditemukan.')
  record.sign = sign
  return { absence: record }
}

export function listPhotosMock({ limit, lastId } = {}) {
  const page = paginate(store.photos, { limit, lastId })
  return { photos: page, last_id: page.length ? page[page.length - 1].id : lastId || '' }
}

export function globalInfoMock() {
  return {
    app_name: 'Takota',
    mode: 'preview',
    total_students: students().length,
    total_attendance_records: store.attendance.length,
    total_absence_records: store.absence.length,
    note: 'Data ini dihasilkan secara lokal untuk mode pratinjau — backend Takota belum tersambung.',
  }
}

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function exportAttendanceServerMock({ month, lang } = {}) {
  const header =
    lang === 'en'
      ? ['Name', 'Username', 'Check-in Count', 'Sick', 'Permit', 'Pending']
      : ['Nama', 'Username', 'Jumlah Hadir', 'Sakit', 'Izin', 'Menunggu']
  const rows = [header.map(csvEscape).join(',')]

  students().forEach((s) => {
    const hadir = store.attendance.filter((a) => a.user_id === s.id).length
    const sakit = store.absence.filter((a) => a.user_id === s.id && a.option === 'sick' && a.sign === 'allow').length
    const izin = store.absence.filter((a) => a.user_id === s.id && a.option === 'permit' && a.sign === 'allow').length
    const pending = store.absence.filter((a) => a.user_id === s.id && a.sign === 'pending').length
    rows.push([s.nickname, s.username, hadir, sakit, izin, pending].map(csvEscape).join(','))
  })

  const csv = '\ufeff' + rows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const filename = `rekap-presensi-${month || 'preview'}-PRATINJAU.csv`
  return { blob, filename }
}

export async function exportAttendancePDFMock({ startDate, endDate } = {}) {
  // Return a minimal valid PDF blob as a placeholder for mock mode
  const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  const blob = new Blob([pdfContent], { type: 'application/pdf' })
  return { blob, filename: `Rekap-Presensi_${startDate || 'start'}_${endDate || 'end'}.pdf` }
}
