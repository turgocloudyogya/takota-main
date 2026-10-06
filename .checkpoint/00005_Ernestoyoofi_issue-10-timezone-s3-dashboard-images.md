# Checkpoint 00005 — Issue #10: timezone, S3 public host, dashboard, images

## Done
- Backend timezone: new `internal/utils/daywindow.go` (`StartOfToday/TodayRange/ParseDateInAppLocation`);
  `user_controller.go` 4× UTC-truncate → app-tz range queries; absence dates parsed in app tz;
  `export_controller.go` month bounds in `AppLocation`; `export_report.go` day keys + today in app tz;
  `dashboard_controller.go` trend window from day start; `helpers.go` warns on bad `TIMEZONE_APP`;
  `GetPublicStatus` now returns `timezone`. No migration touched (query-only change).
- S3: new `S3_USE_PATH_STYLE_PUBLIC_HOST` (default true) in `config.go`; `s3.go` builds
  `readEndpoint` per flag and `GetSignedURL` rewrites scheme+host to `S3_PUBLIC_HOST`
  preserving signature query; `.env.example` (root+backend) and `docker-compose.yml` documented.
- Frontend: `Attendance.jsx`/`Absence.jsx` countdown fallbacks use server-derived `now` only;
  `Absence.jsx` multi-day validation uses server time; `Main.jsx` timezone from backend
  (no hard-coded zone, no emoji), tighter empty-state padding; new `SafeImage.jsx`
  (1:1 box, "Loading..." center, "Image unavailable" + Retry) used in `Photos.jsx`,
  `Main.jsx`, `PhotoPreviewModal.jsx`, `AttendanceDetailDrawer.jsx`, `AdminPhotos.jsx`.
- Admin dashboard rebuilt: action-first panel (pending approvals, accent only here),
  today-at-a-glance (check-ins, leave, peak time, users), totals, question-titled trend,
  heatmap; error state with retry; responsive 1/2/4-col.

## Verified
- `go build ./...` + `go vet ./...`: clean (go 1.27.1 via asdf).
- `npm run build`: success. `npm run lint`: 0 errors, 3 pre-existing exhaustive-deps warnings.
- No hard-coded `Asia/Jakarta` left in UI code (only a comment in `serverTime.js`).
- `git status`: only intended files + 2 new files; `frontend/package-lock.json` reverted.

## Remains
- User review + PR from a `pr/` branch (no commit/push done). Suggested regression tests:
  `TodayRange` Jakarta-midnight, `GetSignedURL` public-host rewrite matrix, `SafeImage` loading/error states.
