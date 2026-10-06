# Checkpoint 00006 — Admin UI polish (borderless, skeletons, nav, theme wipe)

## Done
- Borderless admin panels/cards everywhere (dashboard, users, attendance,
  absence, photos, reports, settings, security, api tester); kept input
  focus borders, row dividers, outline buttons.
- Panel bg scale: panels `neutral-50`, inner surfaces `neutral-100`
  (dark unchanged); page root light back to white so rounded corners read.
- `--radius` locked to 0.75rem on `:root, .light, .dark` (HeroUI sets
  0.5rem under `.light`, which the theme wrapper tripped).
- Dashboard: action-first Leave & Sick panel (hidden at 0 pending,
  requester names), nivo bar (stacked, active days only, 30 desktop /
  15 mobile, default styling, bottom-to-top CSS entrance), heatmap
  score buckets without red, Link-based review button.
- Mobile drawer: framer-motion both ways, blur overlay, gradient panel,
  hamburger morph, header z-105 above drawer z-101.
- Desktop sidebar: gradient bg, floating collapse toggle, grouped nav
  with smooth width/height label animation, no active stripe.
- HeroUI TextField migration (login, change password, security, admin
  toolbars); SegmentedFilter reuse; PageHeader without icon/eyebrow.
- Skeletons for all admin data fetching (`components/Skeletons.jsx`).
- Theme wipe via React 19.3 ViewTransition (separate rollback commit).

## Verified
- `npm run build` success, `eslint` 0 errors (3 pre-existing warnings).
- Backend `go build` + `go vet` clean; live API tests per FIXED-NEW-ISSUE.md.
- Services (db/redis/rustfs) + backend :8080 + vite :5173 running.

## Remains
- User re-check on device (mobile drawer, theme wipe per browser).
- Push + PR when approved (branch pr/issue-10-timezone-s3-dashboard-ui).
