# Checkpoint: cookies-dashboard-absence-batch-2

## Metadata

- **Sequence**: 00003
- **Agent**: Ernestoyoofi
- **Date**: 2026-09-08 13:30:00
- **Branch**: main (dirty)
- **Status**: COMPLETED

## Task Description

1. Ganti localStorage -> cookies untuk session + pastikan Docker/nginx support.
2. Fix dashboard: metrics daily/weekly, full English.
3. Absence user select type English.
4. Admin absence: edit tanggal hanya jika multi-day (>1 hari).
5. 2FA + webpush: PAUSE.

## What Was Done

Cookies (token tak lagi di localStorage/JS):
- BE `auth_controller.go`: login & change-password set `takota_token` (HttpOnly,
  Path=/, SameSite=Lax, MaxAge=JWT_EXPIRY) + `takota_profile` (readable,
  "username|role"); logout clears both. JSON `token` tetap dikembalikan
  (kompat Bruno/header-auth).
- BE `middlewares/auth.go` + `all_controller.go` GetInfo: fallback baca cookie
  bila header Authorization absen.
- FE `lib/cookies.js` baru; `lib/api.js`, `admin/lib/api.js`,
  `lib/authGate.js`, `admin/lib/session.js`, `Login.jsx`, `ChangePassword.jsx`,
  `AdminDashboard.jsx`, `AdminSettings.jsx`: `credentials:"include"`, tanpa
  header Authorization, tanpa simpan token di JS.
- `App.jsx` AuthGate: anti-race — tak wipe cookie bila sesi berubah saat check.
- Nginx/Dockerfile: tanpa ubahan (cookies + Set-Cookie diteruskan default).
  Catatan operasional: backend harus start dengan env dari `backend/.env`
  (`set -a; . ./backend/.env`), karena godotenv baca CWD.

Dashboard:
- BE stats tambah `weekly_avg_checkins`, `weekly_avg_absences` (rerata per hari 7d).
- FE 2 kartu baru "Daily Average Check-ins (7d)" / "Daily Average Absences (7d)";
  fix Quick Action href `/admin/absences` -> `/admin/absence`.

English:
- `Main.jsx` S/I -> "Sick"/"Leave". Select absence + admin chips sudah Inggris
  ("Absence / Leave", "Sick") — terverifikasi di browser.

Admin absence period edit:
- BE `ListAbsences`: `absence_start_date/end_date`, `is_multi_day`.
- BE `SignatureAbsence`: parsial tanggal -> 400; single-day -> 400
  CANNOT_EDIT_SINGLE_DAY; ubah tanggal wajib allow (DATE_CHANGE_REQUIRES_APPROVAL).
- FE: kolom Date tampil rentang + label Multi-day; dialog approve/reject punya
  input Start/End date hanya utk multi-day (single-day: pesan tak bisa edit);
  ubah tanggal otomatis jadi approve + toast info.

## Verification

- [x] `go build` + `go vet` pass; `npm run build` pass
- [x] Set-Cookie HttpOnly terlihat; localStorage hanya theme/sidebar
- [x] Cookie-only `/api/all/info` 200 valid (curl + browser)
- [x] Playwright: admin+user login, semua rute, dashboard weekly avg, absence
  Multi-day, 0 JS error (1x 401 pre-login race, jinak + sudah di-mitigasi)
- [x] API: reject+dates -> 400, allow+dates -> 200, persist 10-13 Sep terlihat di UI

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| backend/internal/controllers/auth_controller.go | Modified | set/clear cookie sesi |
| backend/internal/middlewares/auth.go | Modified | fallback cookie |
| backend/internal/controllers/all_controller.go | Modified | GetInfo terima cookie |
| backend/internal/controllers/admin_controller.go | Modified | is_multi_day + aturan edit |
| backend/internal/controllers/dashboard_controller.go | Modified | weekly avg |
| frontend/src/lib/cookies.js | Created | helper cookie + legacy cleanup |
| frontend/src/lib/api.js, admin/lib/api.js | Modified | credentials include |
| frontend/src/lib/authGate.js | Modified | checkAuth cookie |
| frontend/src/admin/lib/session.js | Modified | sesi dari profile cookie |
| frontend/src/pages/Login.jsx, ChangePassword.jsx | Modified | tanpa localStorage token |
| frontend/src/App.jsx | Modified | anti-race AuthGate |
| frontend/src/admin/pages/AdminDashboard.jsx | Modified | kartu weekly + href fix |
| frontend/src/admin/pages/AdminSettings.jsx | Modified | credentials include |
| frontend/src/pages/Main.jsx | Modified | Sick/Leave penuh |
| frontend/src/admin/lib/normalize.js | Modified | teruskan tanggal/is_multi_day |
| frontend/src/admin/pages/AdminAbsence.jsx | Modified | UI edit period multi-day |

## Remaining Work

- 2FA + web push: PAUSED per instruksi.
- Opt: Secure flag cookie bila prod sudah HTTPS; `takota_profile` tanpa integrity
  (display only, backend sumber kebenaran).

## Follow-up 24:00 — countdown ikut timezone server

- BE status tambah close_at/next_open_day/next_open_time absolut.
- FE lib/serverTime.js: offset jam server vs device; buka/tutup + countdown
  dari timestamp absolut (is_open hanya snapshot awal). WaitingCountdown pakai
  string jam server (sama di semua TZ).
- Terverifikasi: Tokyo + New York tampil countdown sama (~2-3 mnt, tutup
  21:00 WIB), 0 error. Backend PID 84724.

- BE `GET /api/user/dashboard/activity` (data sendiri; hijau=hadir,
  kuning=izin, merah=alpha, abu=kosong). Route user-only.
- /main: kartu Activity + heatmap pribadi 150 hari. Tooltip nivo jadi gelap
  (teks terbaca). Backend PID 56631. Build + PW OK.

- Range 150 hari (5 bulan, Apr-Sep), future s/d Minggu.
- Merah = hadir >0 tapi <5%, atau hari izin (nol hadir + ada izin).
- NOTE: tabel absence kosong (0 records) — data uji lama hilang; heatmap
  terverifikasi via API (level per hari benar). Perlu data uji baru untuk
  melihat sel merah/kuning.

- Grid lengkap s/d Minggu (hari depan = pudar, hover "Upcoming").
- Level 6 [m] oranye tua: tepat 1 hadir, sisanya tanpa laporan.
- Label hari (Mon-Sun) kiri + label bulan (May-Sep) atas. Legend 7 chip.
- Build + PW OK.

- Pudar hanya untuk sel padding (sebelum tanggal pertama), sisa hari kosong
  tetap abu normal; hapus logika faded 30-hari + field-nya.
- Alpha implisit dari aktivitas pertama (sebelumnya kosong -> abu).
- Backend PID 40669. Build + PW OK.

- Hari buka yang kosong total -> abu-abu (alpha hanya bila sebagian lapor).
- Hari kosong >30 hari -> abu ekstra pudar (flag faded).
- Efek hover ring/scale di kotak dihapus, info tetap di baris details.
- Backend PID 37678 (restart env absolut). Build + PW OK.

- BE `GET /api/admin/dashboard/activity` (days, user_id): present/leave/alpha/
  unreported + persen + level 0-5 + closed per hari (app TZ, periode izin
  dicover, reject dikecualikan, alpha hanya hari lampau yang buka).
- FE `ActivityHeatmap.jsx`: grid minggu ala GitHub, hover info persen, legend,
  filter All/specific user (type=user). Terverifikasi visual + hover.
- Backend PID kini 28511 (restart binary baru).

- /main: list Attendance gaya AbsenceCard (badge tanggal, "Checked in at HH:MM",
  lokasi, tanpa foto), maks 20; Absence tetap maks 20. Klik item -> drawer
  AttendanceDetailDrawer (foto, waktu, alamat/koordinat, embed Google Maps).
- Lokasi tak kosong lagi: BE kirim latitude/longitude/gmaps_embed (history +
  today); FE fallback display_address -> "lat, lon".
- BUG BESAR: GetSignedURL hanya kembalikan URL publik tanpa signature padahal
  bucket private -> semua foto 403. Kini presign S3 asli (PresignClient).
- File: user_controller.go, s3.go, Main.jsx, AttendanceDetailDrawer.jsx (baru).

- Popup approve: input date native -> HeroUI DatePicker tersusun vertikal
  (teks, Start date picker, End date picker), tanpa box. Terverifikasi visual.
- File: frontend AdminAbsence.jsx. Build OK.

- Periode mulai = hari submit; user hanya pilih end date (BE default start=today,
  tetap terima start eksplisit backward-compat; end wajib > start, maks 3 bln).
- UI: teks polos toggle (tanpa box/padding) + HeroUI DatePicker + Calendar
  (min H+1, maks 90 hari). Validasi FE + BE lolos, kalender terverifikasi visual.
- File: backend user_controller.go, frontend Absence.jsx. Build BE/FE OK.

- Status tutup dihitung live dari jam + hari (abaikan snapshot is_open basi);
  saat jam buka tiba halaman otomatis flip ke preview kamera / form tanpa reload.
- Transisi closed->open refresh settings dari backend. Terverifikasi Playwright:
  "Absence is Closed" -> form muncul otomatis setelah jam buka lewat.
- Settings restore 06:00-21:00. Build OK.

- Layar WaitingCountdown (/attendance + /absence) tambah header + BackButton
  (sebelumnya tanpa jalan kembali). Klik back terverifikasi kembali ke halaman
  sebelumnya. Settings restore 06:00-21:00. Build + PW OK, 0 error.

- Permission/camera states tanpa tombol: ikon kecil + header + deskripsi
  (arahkan ke site settings), pola sama dgn layar sukses.
- WaitingCountdown disederhanakan ikut pola submitted screen (centered, tanpa
  header/back): ikon warning + "X is Closed" + Opens at/tomorrow/N days +
  live countdown + Open daily. Settings restore 06:00-21:00. Build + PW OK.

- Komponen baru `frontend/src/components/WaitingCountdown.jsx`: box gelap +
  logo Takota di tengah, header "X is Closed", info "Opens at HH:MM" /
  "Opens tomorrow" / "Opens in N days (Day, HH:MM)", live countdown, dan
  "Open daily HH:MM – HH:MM". Dipakai /attendance + /absence.
- Settings restore 06:00-21:00 Mon-Fri. Build + Playwright OK, 0 error.

- Kedip preview: `setVideoElement` -> useCallback (ref detach tiap detik hilang).
- Tombol ganti kamera -> HeroUI Select "Select a camera" (mirip Absence), hanya
  jika >1 kamera; hapus handleToggleCamera.
- Countdown dibuka: BE `Settings.NextOpen` + `next_open` di public status;
  FE tampil "Opens in Xh Ym Zs" saat tutup.
- Locked view = box gelap statis + countdown di bawah (Attendance diutamakan
  di atas permission screen); Absence early-return locked screen sama.
- Settings dikembalikan 06:00-21:00 Mon-Fri. Build + Playwright OK, 0 error.

- Grafik 7-Day Trend diganti recharts ComposedChart -> @nivo/line ResponsiveLine
  (2 seri: Check-ins hijau, Absences oranye, hover slice per tanggal, legend).
- `npm install @nivo/line@^0.99.0`; build + Playwright OK, 0 error.
- recharts masih di package.json (tak dipakai lagi, bisa dihapus terpisah).
- File: frontend/src/admin/pages/AdminDashboard.jsx, package.json/lock.

- Hapus kartu Quick Actions; Overall Statistics jadi kartu ke-9 di grid (3x3 penuh).
- Grafik 7-Day Trend jadi ComposedChart: bar check-ins/absences + garis tren
  biru "Check-ins trend". Build + Playwright OK, 0 error.
- File: frontend/src/admin/pages/AdminDashboard.jsx.

- Backend bg: /tmp/takota-api (env sourced dari backend/.env). FE vite :5173.
- Jangan recreate container Redis tanpa pemberitahuan (sesi auth_id hilang).
