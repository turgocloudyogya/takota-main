# AGENT.md — Takota Contribution Rules

These rules apply to everyone working on this repository, including AI coding agents. Read this file before making any change.

## 1. Branching & Commits

- **Never commit or push directly to `main`.** All work happens on a pull-request branch (e.g. `pr/<topic>` or `feature/<topic>`) and lands in `main` only through a reviewed Pull Request.
- Commit messages must be descriptive and prefixed with a type: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`.
- Only commit and push when the user explicitly asks.
- Never use `--no-verify`, never amend a commit that was already pushed, and never force-push a shared branch.

## 2. Secrets & Environment Variables

- **Never expose secrets.** Do not commit, print, log, or hard-code: `.env` files, database passwords, S3/CloudFront keys, JWT secrets, API tokens, or SSH keys.
- `.env` files must stay gitignored. Only `.env.example` (with placeholder values) may be committed.
- When writing code or documentation, always use placeholders (e.g. `change-me`, `your-secret-key`), never real credentials.
- Before every push, verify with `git status` and `git diff --cached` that no secret or sensitive file is staged.
- If a secret is ever committed, report it immediately and rotate the credential.

## 3. Required Checks Before Pushing to GitHub

Before pushing any change, ALL of the following must pass:

- Backend (from `backend/`): `go build ./...` and `go vet ./...`
- Frontend (from `frontend/`): `npm run build` and `npm run lint`
- Review `git status` and the staged diff to confirm only intended files are included (no `dist/`, `node_modules/`, `backend/.env`, build artifacts, or secrets)
- Any new migration is idempotent and versioned (see section 5)

## 4. Restricted Commands

Do not run these unless the user explicitly approves:

- `git push` to `main` or any production branch
- `git push --force` / `--force-with-lease` on shared branches
- `git commit --amend` or `git rebase` on already-pushed commits
- `git reset --hard` / `git revert` / `git clean` against shared or production branches
- Deleting tracked directories or files with `rm -rf` (double-check the exact paths first)
- Modifying git config, credentials, or SSH/GPG keys
- Running migrations or destructive database commands against production
- Executing package installers or dependency updates (`npm install`, `go get`) without user approval

## 5. Database Migrations

- Add schema changes as a **new** versioned SQL file in `backend/migrations/` following the pattern `00N_<description>.sql`. Never edit an already-applied migration.
- Every migration must be idempotent (`ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, `ON CONFLICT DO NOTHING`, ...) so it is safe to run against databases that were migrated manually.
- The backend applies migrations automatically on startup and tracks applied versions in the `schema_migrations` table.

## 6. Code Style & Conventions

- Follow the existing patterns in the codebase: Go with GORM + Gin on the backend, existing JSX/React patterns on the frontend.
- Do not add code comments unless they add meaningful value.
- Keep changes minimal and focused; do not refactor unrelated code in the same commit.
- Update relevant documentation (READMEs, `ARCHITECTURE.md`) when behavior changes.
