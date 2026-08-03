# Checkpoint Directory

This directory contains checkpoint files that track completed work by AI agents and contributors.

## Purpose

- Audit trail of all changes made
- Track task completion status
- Document what was done and verified
- Maintain history of contributions

## File Format

```
{sequence}_{git.user.name}_{task-description}.md
```

Example: `00001_raka_fixing-endpoint-backend.md`

## How to Use

1. Before starting work, check existing checkpoints for context
2. After completing work, create a new checkpoint file
3. Use the template from `CHECKPOINT.md` in the project root
4. Increment the sequence number from the latest checkpoint

## Finding Checkpoints

```bash
# List all checkpoints
ls .checkpoint/

# Find latest checkpoint
ls -t .checkpoint/ | head -1

# Search by task
grep -l "task-name" .checkpoint/*.md
```
