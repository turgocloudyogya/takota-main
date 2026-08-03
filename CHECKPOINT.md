# CHECKPOINT.md - Work Completion Tracking

This file explains the checkpoint system for tracking AI agent work completion.

## Overview

Every completed task must have a corresponding checkpoint file in the `.checkpoint/` directory. This creates an audit trail of what was done, when, and by whom.

## Checkpoint File Format

```
.checkpoint/{sequence}_{git.user.name}_{task-description}.md
```

### Components

- **sequence**: 5-digit zero-padded number (e.g., `00001`, `00002`)
- **git.user.name**: Git username of the agent/person (e.g., `raka`, `ai-agent`)
- **task-description**: Short description with hyphens (e.g., `fixing-endpoint-backend`, `adding-api-tests`)

### Examples

```
.checkpoint/00001_raka_fixing-endpoint-backend.md
.checkpoint/00002_ai-agent_adding-api-tests.md
.checkpoint/00003_raka_updating-docs.md
```

## Checkpoint File Template

Every checkpoint file MUST contain:

```markdown
# Checkpoint: {task-description}

## Metadata

- **Sequence**: {sequence}
- **Agent**: {git.user.name}
- **Date**: {YYYY-MM-DD HH:MM:SS}
- **Branch**: {branch-name}
- **Status**: COMPLETED | PARTIAL | BLOCKED

## Task Description

{What was requested}

## What Was Done

- {List of changes made}
- {Files modified}
- {Files created}

## Verification

- [ ] Code compiles/builds
- [ ] No hardcoded credentials
- [ ] All placeholders safe
- [ ] Documentation updated
- [ ] Tests pass (if applicable)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| path/to/file.js | Modified | What changed |
| path/to/new-file.js | Created | What it does |

## Remaining Work

- {Any incomplete items}
- {Follow-up tasks}

## Notes

- {Any important notes}
- {Decisions made}
- {Issues encountered}
```

## Sequence Numbering

1. Check existing checkpoint files for the highest sequence number
2. Increment by 1 for the new checkpoint
3. Use zero-padding to 5 digits

Example:
- Existing: `00003_raka_something.md`
- New: `00004_{agent}_{task}.md`

## Agent Name

Use the git username configured on the system:
```bash
git config user.name
```

If not configured, use `ai-agent` as the default.

## When to Create Checkpoints

Create a checkpoint file when:

1. A task is completed
2. A significant milestone is reached
3. Work is paused (status: PARTIAL)
4. Work is blocked (status: BLOCKED)

## Status Values

- **COMPLETED**: Task fully done, all verification passed
- **PARTIAL**: Work in progress, not yet complete
- **BLOCKED**: Cannot proceed, requires user input or external dependency

## Example Checkpoint

```markdown
# Checkpoint: adding-api-tests

## Metadata

- **Sequence**: 00001
- **Agent**: raka
- **Date**: 2026-08-03 14:30:00
- **Branch**: feature/api-tests
- **Status**: COMPLETED

## Task Description

Add API integration tests to pr-checks.yml workflow.

## What Was Done

- Updated .github/workflows/pr-checks.yml
- Added api-test job with service containers
- Added tests for login, attendance, and admin endpoints

## Verification

- [x] Code compiles/builds
- [x] No hardcoded credentials
- [x] All placeholders safe
- [x] Documentation updated
- [x] Tests pass (if applicable)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| .github/workflows/pr-checks.yml | Modified | Added API test job |

## Remaining Work

- None

## Notes

- Used service containers for PostgreSQL and MinIO
- All test credentials use CI-safe placeholders
```

## Listing Checkpoints

To see all checkpoints:

```bash
ls -la .checkpoint/
```

To see the latest checkpoint:

```bash
ls -t .checkpoint/ | head -1
```

To search for specific tasks:

```bash
grep -l "task-description" .checkpoint/*.md
```
