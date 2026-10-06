# FIXED-NEW-ISSUE.md — Fix Plan for Issue #10

Source: `https://github.com/turgocloudyogya/takota-main/issues/10`
Scope: `backend/`, `frontend/src/`, `docker-compose.yml`, `.env.example`
Timezone standard: `TIMEZONE_APP=Asia/Jakarta` (env-driven, never hard-coded).

---

## 1. Attendance and Permission Timezone Mismatch (CRITICAL)

### Root cause (verified in codebase)

Barrier/gate is correct, day-query is not:

- `backend/internal/utils/helpers.go:44-45` — `Now()` returns `time.Now().In(appLocation())`. Correct.
- `backend/internal/middlewares/attendance_time.go:30-31` — uses `utils.Now()` + `IsAttendanceOpen`. Correct.
- `backend/internal/controllers/admin_settings_controller.go:77-82` — `GetPublicStatus` uses `utils.Now()` and returns `now/next_open/close_at` as RFC3339. Correct.

But "today" lookup is UTC-midnight based:

- `backend/internal/controllers/user_controller.go:108` — `today := time.Now().UTC().Truncate(24*time.Hour)` then `created_at >= today`. At 06:00 WIB (= 23:00 UTC previous day) this window starts at 00:00 UTC today, which is 07:00 WIB today. A check-in at 06:00–06:59 WIB falls before the window → shows yesterday / empty, and duplicate-check misses.
- Same pattern at `user_controller.go:229,327,406` with `DATE(created_at) = DATE(?)` against a UTC-truncated date. `DATE()` evaluates in DB session timezone (usually UTC in docker `postgres:16-alpine`), not `TIMEZONE_APP`.
- `backend/internal/controllers/export_controller.go:96`, `export_report.go:235`, `dashboard_controller` (check trend/stats day-bucketing) — same UTC assumption, verify before touching.

Frontend fallback re-introduces local-tz bug:

- `frontend/src/pages/Attendance.jsx:240-246,261-264` — fallback path does `new Date()` + `setHours()` in device-local tz. If `close_at/next_open` missing, a user in UTC+9 sees a different window than server.
- `frontend/src/pages/Main.jsx:66,111,136` — greeting falls back to `new Date().getHours()` (local), check-in header hard-codes `timeZone: 'Asia/Jakarta'`. Must read timezone from backend `settings/timezone` instead of literal.
- `frontend/src/pages/Absence.jsx:157,171,255` — same `new Date()` + local weekday logic.

### Fix checklist

1. Add `backend/internal/utils/daywindow.go`:
   ```go
   func StartOfToday() time.Time { // 00:00:00 in AppLocation
     now := Now()
     return time.Date(now.Year(), now.Month(), now.Day(), 0,0,0,0, now.Location())
   }
   func TodayRange() (start, end time.Time) {
     s := StartOfToday()
     return s, s.AddDate(0,0,1)
   }
   ```
2. Replace every `time.Now().UTC().Truncate(24*time.Hour)` + `DATE(created_at)=DATE(?)` with range query:
   ```go
   start, end := utils.TodayRange()
   db.Where("user_id=? AND type=? AND created_at >= ? AND created_at < ?", uid, "attendance", start.UTC(), end.UTC())
   ```
   Files: `user_controller.go:108,229,327,406`. Keep `.UTC()` only at DB boundary (timestamptz storage); all comparisons in app-tz-derived instants.
3. Alternative if SQL DATE kept: `DATE(created_at AT TIME ZONE 'Asia/Jakarta')` is wrong — timezone must come from `config.App.Timezone`, pass as param, never string-interpolate. Prefer range query above.
4. `admin_settings_controller.go:GetPublicStatus` — already returns `now` with offset. Keep it. Frontend must always prefer `is_open/next_open/close_at` and never recompute from `attendance_open_time` strings in local tz. Delete `attendanceIsClosed` fallback math or gate it to server-derived `now` only (`serverNow(delta)`), not `new Date()`.
5. Expose timezone to frontend: add `timezone` field to `GetPublicStatus` response (`utils.AppLocation().String()`), and replace hard-coded `'Asia/Jakarta'` in `Main.jsx:136,138` with that value (prop/context, fallback `Intl.DateTimeFormat().resolvedOptions().timeZone` only for display, never for gate).
6. Docker: set `TZ` + mount `tzdata` already in final image (`ARCHITECTURE.md:308`). Verify `docker/entrypoint.sh` exports `TZ=$TIMEZONE_APP` so `time.LoadLocation` never falls back to UTC silently. Log warning when `LoadLocation` fails (currently silent in `helpers.go:19-23`).
7. Regression loop (tight, red-capable, per diagnosing-bugs):
   ```bash
   # Backend: set TIMEZONE_APP=Asia/Jakarta, seed settings 18:00-21:00, freeze Now() to 06:00 WIB next day
   go test ./internal/models/ -run TestIsAttendanceOpen_NextDay -count=1
   go test ./internal/controllers/ -run TestTodayRange_JakartaMidnight -count=1
   ```
   Write test first: 06:00 WIB with window 18:00-21:00 must be CLOSED with `next_open` today 18:00 WIB, and `Home.today` must be nil (not yesterday's row).

---

## 2. Attendance Fails on Different Timezones

Same root cause as §1, different symptom. The middleware is server-tz correct, but:

- Duplicate/absence guards use UTC day (see §1), so a 07:00 WIB check-in can be rejected as "already submitted" (matched yesterday's UTC date) or "closed" (frontend local-tz fallback says closed while server says open).
- `Absence.jsx` multi-day `startDate/endDate` parsed with `time.Parse("2006-01-02", ...)` → midnight UTC, then compared to UTC `today`. A user in UTC+9 submitting at 00:30 local gets a different `today` than server.

Fix: same `TodayRange()` change + parse absence dates in `AppLocation()`:
```go
loc := utils.AppLocation()
endDate, _ := time.ParseInLocation("2006-01-02", req.AbsenceEndDate, loc)
```
Frontend: `Attendance.jsx:184-186` already documents server-delta approach — enforce it: remove all `new Date().setHours()` branches; if `next_open/close_at` absent, show skeleton, do not guess.

---

## 3. Custom S3 Public Host Not Working + New Env `S3_USE_PATH_STYLE_PUBLIC_HOST`

### Root cause (verified)

- `backend/pkg/s3/s3.go:60-81` builds `readEndpoint` with `PublicHost`, but `GetSignedURL()` at `s3.go:302-326` ignores it completely — always returns `presigner.PresignGetObject` URL signed against `S3_ENDPOINT`. So `BucketOpenURL()` respects `S3_PUBLIC_HOST`, signed photo URLs do not. Photos gallery, `Home.today.photo_url`, admin lists all use `GetSignedURL` → custom host never appears.
- Path-style is forced from one flag: `UsePathStyleEndpoint` (`config.go:138`). For rustfs the SDK endpoint needs `true`, but the public preview host may need `false` (virtual-hosted). No separate flag exists, so setting `S3_PUBLIC_HOST` to a virtual-hosted URL still gets `host/bucket/key` (line 76) → 404/NoSuchBucket.

### Fix checklist

1. `backend/internal/config/config.go:S3Config` add:
   ```go
   UsePathStylePublicHost bool // S3_USE_PATH_STYLE_PUBLIC_HOST, default true
   ```
   Load: `getEnvAsBool("S3_USE_PATH_STYLE_PUBLIC_HOST", true)`.
2. `backend/pkg/s3/s3.go:InitS3` — build `readEndpoint` respecting the new flag:
   ```go
   if publicHost != "" {
     if usePathStylePublicHost { readEndpoint = publicHost + "/" + bucket + "/{{file}}" }
     else { readEndpoint = publicHost + "/{{file}}" }
   }
   ```
   Trim trailing `/` from `publicHost` first.
3. `GetSignedURL` — rewrite host after presign (signature stays valid because host is not part of SigV4 for path-style when switching host+path consistently; safest: replace only scheme+host, keep path+query):
   ```go
   url := req.URL
   if Config.PublicHost != "" {
     if u, err := urlpkg.Parse(url); err == nil {
       if pub, err := urlpkg.Parse(Config.PublicHost); err == nil {
         u.Scheme = pub.Scheme; u.Host = pub.Host
         // if !UsePathStylePublicHost and path starts with /bucket, strip it
         url = u.String()
       }
     }
   }
   return url, nil
   ```
   Handle both directions (strip or prepend `/bucket`) based on `UsePathStylePublicHost` vs `UsePathStyleEndpoint` mismatch.
4. Docs/env:
   - `backend/.env.example:57` add `S3_USE_PATH_STYLE_PUBLIC_HOST=true` with comment: rustfs SDK endpoint usually `true`; public preview host set `false` when using virtual-hosted/CDN domain.
   - Root `.env.example` (only `TIMEZONE_APP` currently) — add full S3 block placeholders, never real keys.
   - `docker-compose.yml:85` add `S3_PUBLIC_HOST` is present but uses in-cluster `http://rustfs:9000` which browsers cannot reach; document that production must set public URL (e.g. `https://your-s3-public-host.com`) while `S3_ENDPOINT` stays `http://rustfs:9000`. Add `S3_USE_PATH_STYLE_PUBLIC_HOST: "false"` example commented.
5. Regression: unit test `TestGetSignedURL_RewritesToPublicHost` with fake endpoint + public host, assert host rewritten and `X-Amz-Signature` query preserved; test both path-style true/false matrix.

---

## 4. UI and Dashboard Optimization (`/admin/*`)

Per `@antislop-ui`: current `AdminDashboard.jsx:127-258` is 9 uniform stat cards + generic trend + heatmap — classic "default dashboard shell / stat cards" tell. No hierarchy, accent spread across 8 icon colors, no decision-driven order.

Do (minimal, no AI-slop):

- [ ] Hierarchy first: one primary panel = "needs action today" (pending approvals + today's missing check-ins + open/closed status with countdown). Stat row becomes footnote, not hero. Cut cards that duplicate (`weekly_avg` ×2 can merge into trend subtitle which already computes it at line 266-270).
- [ ] Palette: 2-3 cores + 1 accent. Current: blue/green/orange/yellow/purple/indigo/teal/rose on one page. Keep neutral cards, single accent (e.g. pending-approval amber) only where action needed.
- [ ] No new bento mosaic, no glow/gradient hero, no capsule "AI Powered" badges, no emoji in UI (greeting `👋` in `Main.jsx:358` — replace with plain text or avatar initial).
- [ ] Every number real or labelled placeholder — already real via API, keep it; add named comparison period to any delta added (never bare "+12%").
- [ ] Empty/loading/error states must name cause + next action (`AdminDashboard.jsx:101-115` currently "Loading dashboard..." / "Failed to load" — add retry button + what failed).
- [ ] Keep `AdminLayout.jsx` shell (sidebar collapse, tooltips, mobile drawer) — only tighten spacing/rhythm; vary section composition per RHYTHM dial instead of identical `rounded-lg border p-4` ×9.
- [ ] Verify at 360px / 768px / 1440px, light + dark, keyboard-only nav.

---

## 5. Images Not Displaying Properly (1:1 `Loading...`, error thumbnail)

### Root cause (verified)

Raw `<img>` with no load/error state everywhere:

- `frontend/src/pages/Photos.jsx:122`, `frontend/src/pages/Main.jsx:389`, `frontend/src/components/PhotoPreviewModal.jsx:42`, `frontend/src/components/AttendanceDetailDrawer.jsx:58`, `frontend/src/admin/pages/AdminPhotos.jsx` (same pattern) — no `onLoad/onError`, so broken URL = empty box / broken layout. Only full-page skeletons exist (`Photos.jsx:107-111` pulse grid), nothing per-image.
- Issue also notes "excessive padding around picture preview on /main" — `Main.jsx:387-396` uses `w-20 h-20` thumb + `p-3/p-8` wrappers; when image missing it collapses to blank `bg-neutral-200` div with no label.

### Fix checklist

1. New `frontend/src/components/SafeImage.jsx` (single seam, used everywhere):
   ```jsx
   // states: loading → tiny centered "Loading..." text on 1:1 box;
   // error → neutral box with icon + "Image unavailable" + retry button; never breaks layout
   ```
   - Keep `aspect-square` container fixed; overlay absolute centered `text-[11px]` "Loading..." while `!loaded && !error`.
   - `onError` → error thumbnail (icon + label), `onRetry` re-sets `src` with cache-buster.
   - `loading="lazy"`, `referrerPolicy="no-referrer"` for S3 signed URLs.
2. Replace all raw `<img>` listed above with `<SafeImage>`. Keep `object-cover` for grid thumbs, `object-contain` for preview modal.
3. `/main` preview: reduce wrapper padding (`p-8` → `p-4`), cap thumb at `w-20 h-20 rounded-lg`, error state same size so row height never jumps.
4. Regression: story/test — render `SafeImage` with `src="https://invalid.local/x.jpg"`, assert "Image unavailable" appears and parent keeps `aspect-square`; render with slow src, assert "Loading..." visible before `onLoad`.

---

## File-by-file work list (for PR)

| # | File | Change |
|---|------|--------|
| 1 | `backend/internal/utils/daywindow.go` (new) | `StartOfToday/TodayRange` in `AppLocation` |
| 2 | `backend/internal/controllers/user_controller.go` | Replace 4× UTC-truncate with `TodayRange`; `ParseInLocation` for absence dates |
| 3 | `backend/internal/controllers/export_controller.go`, `export_report.go`, `dashboard_controller.go` | Same UTC→range audit |
| 4 | `backend/internal/utils/helpers.go` | Log warn on `LoadLocation` failure |
| 5 | `backend/internal/controllers/admin_settings_controller.go` | Add `timezone` to `GetPublicStatus` |
| 6 | `backend/internal/config/config.go` | Add `UsePathStylePublicHost` |
| 7 | `backend/pkg/s3/s3.go` | Respect new flag in `readEndpoint` + rewrite host in `GetSignedURL` |
| 8 | `backend/.env.example`, `.env.example`, `docker-compose.yml` | Add `S3_USE_PATH_STYLE_PUBLIC_HOST`, fix `S3_PUBLIC_HOST` docs |
| 9 | `frontend/src/pages/Attendance.jsx`, `Absence.jsx` | Delete local-tz fallback math, use `serverNow/parseAbsolute` only |
| 10 | `frontend/src/pages/Main.jsx` | Timezone from backend, not literal; fix greeting fallback |
| 11 | `frontend/src/components/SafeImage.jsx` (new) | Loading/error thumbnail |
| 12 | `frontend/src/pages/Photos.jsx`, `Main.jsx`, `PhotoPreviewModal.jsx`, `AttendanceDetailDrawer.jsx`, `AdminPhotos.jsx` | Use `SafeImage`, trim preview padding |
| 13 | `frontend/src/admin/pages/AdminDashboard.jsx` | Hierarchy + accent restraint + real empty/error states (antislop-ui checklist) |

## Verification (must pass before push, per AGENTS.md §3)

```bash
# backend
cd backend && go build ./... && go vet ./...
# frontend
cd frontend && npm run build && npm run lint
git status && git diff --cached  # no .env, no secrets, placeholders only
```

## Review findings (runtime test 2026-10-06, service stack `docker-compose-service.yml`)

- **Infinite loop in `getNextAttendanceOpen`** (`backend/internal/middlewares/attendance_time.go`):
  the old `for {}` + `nextOpen.After(checkTime)` never terminates when
  `attendance_open_time` is `00:00` and the scan lands on midnight of a valid
  day — every closed-gate request hangs forever. Found by shrinking the window
  to `00:00-00:01` and POSTing attendance (request hung, no `403`). Fixed with
  `!nextOpen.Before(checkTime)` (same semantics as `Settings.NextOpen`) plus an
  8-iteration cap with `now` fallback. Verified: closed submit now returns
  `403 ATTENDANCE_CLOSED` instantly with correct `next_open` in `+07:00`.
- Verified live (Asia/Jakarta 18:24, window 06:00-21:00): submit OK, `home.today`
  shows the check-in (not yesterday's), duplicate → `400
  ATTENDANCE_ALREADY_SUBMITTED`, absence after check-in →
  `CANNOT_SUBMIT_ABSENCE_AFTER_ATTENDANCE`, signed `photo_url` on
  `S3_PUBLIC_HOST` returns `200 image/jpeg` with signature query intact,
  dashboard stats + trend + CSV export all in `+07:00`.
- `rewriteToPublicHost` matrix (path-style true/false/empty) passes as a
  throwaway `go test` (removed afterwards); no new migration (query-only
  changes); browser E2E not possible in this container (chromium system libs
  missing), so UI verified via `vite build` + `eslint` + vite-proxy data path.
