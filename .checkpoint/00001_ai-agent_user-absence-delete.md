# Checkpoint: user-absence-delete

## Metadata

- **Sequence**: 00001
- **Agent**: ai-agent
- **Date**: 2026-08-07
- **Branch**: (no git user configured)
- **Status**: COMPLETED

## Task Description

Add a feature so a user can delete their own absence/sick request before it has been approved by the admin. Requirements:

- Delete is available to users only (not admins).
- A user can only delete their own absence requests, never someone else's.
- A request that has already been accepted (`allow`) or rejected (`reject`) cannot be deleted.
- Add a delete button on the right side of the absence card in the frontend.

## What Was Done

### Backend

- `backend/internal/controllers/user_controller.go`:
  - Added `DeleteAbsence` handler that resolves the record by `id` AND `user_id` (ownership enforced at the query level), rejects non-`absence` records, blocks deletion once `sign_status` is set (accepted/rejected), deletes the uploaded document from S3, then removes the row.
  - Extended the home `AbsenceItem` payload with `id`, `reason`, and `timestamp` so the frontend can identify and delete the right record and show the real date.
- `backend/internal/utils/response.go`: added `ErrCannotDeleteVerifiedAbsence` error code (`CANNOT_DELETE_VERIFIED_ABSENCE`).
- `backend/cmd/api/main.go`: registered `DELETE /api/user/absence/:absence_id` under the authenticated user group.

### Frontend

- `frontend/src/lib/api.js`: added `deleteAbsence(absenceId)` API client.
- `frontend/src/components/AbsenceCard.jsx`: renders a trash (delete) button on the right side only when an `onDelete` handler is provided.
- `frontend/src/pages/Main.jsx`:
  - Maps absence items with real id/timestamp and only exposes the delete action for `pending` status.
  - Added confirm dialog and delete handler that calls `deleteAbsence`, toasts the result, and removes the item from the local list.

## Verification

- [x] Backend compiles: `CGO_ENABLED=0 go build ./...`
- [x] Backend vet passes: `CGO_ENABLED=0 go vet ./...`
- [x] Frontend builds: `bun run build`
- [x] Frontend lint passes: `bun run lint`
- [x] No hardcoded credentials
- [x] All placeholders safe
- [x] Documentation updated

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| backend/internal/controllers/user_controller.go | Modified | Added `DeleteAbsence` handler + id/reason/timestamp in home absence payload |
| backend/internal/utils/response.go | Modified | Added `ErrCannotDeleteVerifiedAbsence` error code |
| backend/cmd/api/main.go | Modified | Registered `DELETE /api/user/absence/:absence_id` |
| frontend/src/lib/api.js | Modified | Added `deleteAbsence` API client |
| frontend/src/components/AbsenceCard.jsx | Modified | Added right-side delete button |
| frontend/src/pages/Main.jsx | Modified | Wired delete action + confirm dialog |

## Remaining Work

- None

## Notes

- Pending is determined by `sign_status IS NULL` (an admin sets both `verify_by` and `sign_status` in one update, so a pending record has both null).
- Backend build was verified with `CGO_ENABLED=0` because the WSL environment lacks C build headers; the production Dockerfile already uses `CGO_ENABLED=0`.
- Frontend tooling runs via `bun` (available at `~/.bun/bin/bun`); `npm`/`node` are Windows binaries that cannot run against the WSL UNC path.
