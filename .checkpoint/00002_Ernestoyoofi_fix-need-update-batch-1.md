# Checkpoint: fix-need-update-batch-1

## Metadata

- **Sequence**: 00002
- **Agent**: Ernestoyoofi
- **Date**: 2026-09-08 12:30:00
- **Branch**: main (dirty, uncommitted prior AI work + this fix)
- **Status**: PARTIAL

## Task Description

Audit + perbaiki permintaan NEED-UPDATE.md (item 1-9), jalankan backend+frontend background,
verifikasi via Playwright untuk admin dan user biasa.

## What Was Done

Backend (`go build` + `go vet` OK):
- `models/settings.go`: perbaiki `IsAttendanceOpen` (day-match selalu false karena
  potong 3 huruf tanpa lowercase) + `OpenDays.Scan` terima `string`/`[]byte`.
- `middlewares/attendance_time.go`: hapus double-response, pakai `utils.Now()`
  (TIMEZONE_APP), day-match case-insensitive.
- `controllers/dashboard_controller.go`: alpha kurangi absence + 0 saat hari libur,
  timezone app untuk batas hari, most-frequent per jam, trend pivot attendance/absence.
- `controllers/admin_settings_controller.go`: GET kembalikan default 06:00-21:00 Mon-Fri
  saat tabel kosong; validasi (close>open, min 1 hari, case-insensitive); tambah
  `GetPublicStatus` untuk countdown user.
- `cmd/api/main.go`: route baru `GET /api/all/settings/status` (auth, semua role).
- `controllers/all_controller.go`: `PhotoItem` sertakan display_address/latitude/
  longitude/gmaps_embed agar galeri bisa tampilkan lokasi.
- `frontend/src/lib/api.js`: `getSettings()` pindah ke `/api/all/settings/status`
  (endpoint admin-only bikin 403 untuk user).

Frontend (`npm run build` OK):
- `Main.jsx`: Today card petakan photo_url/timestamp/display_address + teks Inggris.
- `Attendance.jsx`: tambah `captureFrame()` (sebelumnya ReferenceError), enumerate
  kamera setelah getUserMedia, selector tombol Front/Back/Camera-N (hide jika 1 kamera),
  countdown "There are N more days of Attendance".
- `Absence.jsx`: perbaiki polling storm (fetch settings tiap detik), validasi FE
  (start>=H+1, maks 90 hari), teks countdown sesuai spec.
- `Photos.jsx` + `PhotoPreviewModal.jsx`: teruskan + tampilkan display_address.
- `AdminDashboard.jsx`: tambah grafik BarChart recharts untuk 7-day trend.

Infra test:
- `docker-compose-service.yml` up (db:5003, minio:5001, redis:5000).
- Backend `/tmp/takota-api` via setsid (survive shell timeout), FE vite :5173.
- Playwright CLI (chromium) gantikan MCP yang butuh /opt/google/chrome/chrome.

## Verification

- [x] `go build ./...` + `go vet ./...` pass
- [x] `npm run build` pass (`npm run lint` sisa error pre-existing)
- [x] Login admin -> /admin/dashboard, user -> /main via Playwright, 0 console error
- [x] Semua rute /admin/* dan /main,/attendance,/absence,/photos render OK
- [x] API: settings GET, public status (is_open true, +07:00), dashboard stats OK
- [ ] 2FA persist/enforce + push VAPID + admin edit tanggal absence: BELUM (rusak, audit ada)
- [ ] Submit attendance end-to-end dgn kamera/GPS asli: BELUM (headless tanpa device)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| backend/internal/models/settings.go | Modified | day-match + Scan fix |
| backend/internal/middlewares/attendance_time.go | Modified | double-response + timezone fix |
| backend/internal/controllers/dashboard_controller.go | Modified | alpha/libur/timezone/trend fix |
| backend/internal/controllers/admin_settings_controller.go | Modified | default + validasi + public status |
| backend/internal/controllers/all_controller.go | Modified | lokasi di PhotoItem |
| backend/cmd/api/main.go | Modified | route settings/status |
| frontend/src/lib/api.js | Modified | getSettings ke endpoint publik |
| frontend/src/pages/Main.jsx | Modified | Today foto + lokasi |
| frontend/src/pages/Attendance.jsx | Modified | captureFrame + kamera + countdown |
| frontend/src/pages/Absence.jsx | Modified | polling + validasi + countdown |
| frontend/src/pages/Photos.jsx | Modified | teruskan lokasi |
| frontend/src/components/PhotoPreviewModal.jsx | Modified | tampilkan lokasi |
| frontend/src/admin/pages/AdminDashboard.jsx | Modified | grafik trend |

## Remaining Work (updated 12:45)

- MCP Playwright: config diubah ke `--browser chromium --headless`, perlu restart opencode.
- GuideOverlay hijack: FIXED (hanya navigasi saat user klik Next/Back).
- Bounce ke login: sebagian besar karena Redis di-recreate (sesi auth_id hilang) +
  single-device by design; bukan bug routing.

- 2FA: secret tidak dipersist, verify via header client, login tak enforce (butuh redesign).
- Push: bukan Web Push terenkripsi, tanpa VAPID, tanpa cleanup per-device, entrypoint.sh tanpa cron.
- Admin absence edit tanggal: wajib allow saat tanggal diubah (spec item 6).
- `POST /user/absence` belum dipasang time-gating (keputusan: perlu konfirmasi).
- MCP Playwright butuh `sudo mkdir -p /opt/google/chrome && sudo ln -s ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome /opt/google/chrome/chrome`.

## Notes

- GuideOverlay admin auto-navigate ke /admin/dashboard saat guide belum done: by design,
  test deep-link harus set `takota-admin-guide-done=1`.
- Server background: backend pid via setsid (/tmp/takota-api), frontend vite pid 5485.
