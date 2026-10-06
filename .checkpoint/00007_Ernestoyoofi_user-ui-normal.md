# Checkpoint 00007 — User UI normal (/main + pages)

## Done
- /main panels borderless, light bg neutral-50 (same as admin).
- /main/2fa header uses shared BackButton (pill `< label`).
- BackButton bundles ThemeToggle: photos, attendance, absence, 2fa
  headers get the toggle automatically, pinned right via flex spacer.
- Fresh vite dev server (stale HMR bundle cleared).

## Verified
- `npm run build` success, `eslint` 0 errors.
- Awaiting user device re-check.

## Remains
- Push + PR when approved.
