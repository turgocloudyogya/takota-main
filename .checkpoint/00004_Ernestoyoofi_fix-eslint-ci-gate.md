# Checkpoint 00004 — Fix `npm run lint` (CI gate for PR to main)

## Problem
`npm run lint` (eslint, CI `pr-checks`) failed with 20 errors, blocking merge of
`pr/2fa-passkey-push` into `main`. Most errors were pre-existing; all had to go green.

## Fixes (frontend only, no behavior change)
- `public/service-worker.js`: `/* global clients:readonly */`, dropped unused `event` param.
- `App.jsx`: removed unused `useState`; AuthGate effect now deps `[location.pathname, navigate]`
  (matches documented "re-validate on every route change").
- `admin/lib/api.js`: removed unused `auth` request option (was never read).
- `AdminAttendance.jsx`: removed unused `formatDateTime`.
- `Absence.jsx`: removed unused `TriangleExclamation` import.
- `Attendance.jsx`: `const [facingMode]` (setter unused; value still used).
- `GuideOverlay.jsx` / `PageGuideOverlay.jsx`: ref assignment moved into `useEffect`.
- `AdminDashboard.jsx` / `AdminSettings.jsx`: fetchers → `useCallback` declared before effects,
  effects use inner `async init()` wrappers; removed never-read `settings` state.
- `PushNotifications.jsx`: unsupported-browser branch resolves loading via timeout callback.
- `Security2FA.jsx`: deleted (dead legacy component superseded by `SecuritySettings.jsx`).
- `Absence.jsx` / `Attendance.jsx`: mount effects call fetchers through inner `async init()`
  wrappers (rejected `useEffectEvent`: illegal from event handlers and still flagged).

## Verification
- `npm run lint` → exit 0 (0 errors, 3 warnings: intentional `[]` interval effects).
- `npm run build` → OK.
- Runtime smoke (user001 + admin): /main, /attendance, /absence, /admin/dashboard,
  /admin/settings all render, 0 console errors.
- Rejected approach documented: `useEffectEvent` for functions shared with event handlers.
