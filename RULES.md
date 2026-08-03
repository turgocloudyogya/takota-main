# RULES.md - AI Agent Rules

These rules are **mandatory** for all AI coding agents working on this repository. Violating any rule will result in the task being rejected. Read this file completely before starting any work.

## Rule 1: Credential Security

### 1.1 No Hardcoded Credentials

NEVER hardcode credentials in any file. This includes but is not limited to:

- Database passwords
- JWT secrets
- S3/CloudFront access keys
- API tokens
- SSH keys
- Encryption keys
- Session secrets

### 1.2 No Credentials in Documentation

NEVER include real credentials in documentation files, comments, or logs. All examples MUST use placeholders:

```
WRONG:
  JWT_SECRET=my-super-secret-key-12345
  DB_PASSWORD=realpassword123

RIGHT:
  JWT_SECRET=change-me-in-production
  DB_PASSWORD=your-database-password
  S3_ACCESS_KEY=your-access-key
```

### 1.3 No Credentials in Git History

NEVER commit files containing real credentials. Before every commit:

1. Run `git diff --cached` and review all changes
2. Check for any string that looks like a password, key, or token
3. If a credential is found, unstage the file and remove the credential

### 1.4 Placeholder Values

All configuration files, examples, and documentation MUST use placeholder values:

| Type | Placeholder Format |
|------|-------------------|
| Password | `your-password-here` or `change-me` |
| Secret | `your-secret-key` or `change-me-in-production` |
| Access Key | `your-access-key` |
| Endpoint | `http://localhost:PORT` |
| Host | `localhost` or `your-host` |
| Token | `your-jwt-token` or `Bearer <TOKEN>` |

### 1.5 Environment Files

- NEVER commit `.env` files
- ONLY commit `.env.example` with placeholder values
- ALWAYS add `.env` to `.gitignore`
- NEVER log or print environment variable values

## Rule 2: Code Safety

### 2.1 No Destructive Commands

NEVER run destructive commands without explicit user approval:

- `rm -rf` on important directories
- `git reset --hard`
- `git push --force`
- Database `DROP` or `TRUNCATE`
- `docker system prune` (without user approval)

### 2.2 No Direct Production Changes

NEVER make changes directly to production:

- Always test changes in development first
- Use pull requests for all changes
- Never run migrations against production without approval

### 2.3 No Unrelated Refactoring

NEVER refactor code that is not directly related to the current task:

- Keep changes minimal and focused
- Do not rename variables or functions unless required
- Do not reformat code unless it is part of the task

## Rule 3: File Safety

### 3.1 No Secrets in New Files

When creating new files:

- Use placeholder values for all credentials
- Add comments indicating where real values should be placed
- Example: `DB_PASSWORD=change-me-in-production # REPLACE WITH REAL PASSWORD`

### 3.2 No Secrets in Committed Files

Before committing any file:

1. Review the entire file content
2. Search for patterns that match credentials:
   - Long random strings
   - Base64 encoded values
   - Hex strings
   - AWS-style keys (AKIA...)
   - JWT tokens (eyJ...)
3. If found, replace with placeholders

### 3.3 Sensitive File Patterns

These files should NEVER be committed:

- `.env`
- `.env.local`
- `.env.production`
- `*.pem`
- `*.key`
- `*credentials*`
- `*secret*`

## Rule 4: Documentation Safety

### 4.1 No Real URLs

NEVER include real URLs to production services in documentation:

```
WRONG:
  API_ENDPOINT=https://api.production.takota.com

RIGHT:
  API_ENDPOINT=http://localhost:8080
  API_ENDPOINT=https://your-api-domain.com
```

### 4.2 No Real IP Addresses

NEVER include real server IP addresses in documentation:

```
WRONG:
  DB_HOST=192.168.1.100

RIGHT:
  DB_HOST=localhost
  DB_HOST=your-database-host
```

### 4.3 No Real Domain Names

NEVER include real domain names in documentation:

```
WRONG:
  S3_ENDPOINT=https://mycompany.s3.amazonaws.com

RIGHT:
  S3_ENDPOINT=http://localhost:9000
  S3_ENDPOINT=https://your-s3-endpoint.com
```

## Rule 5: Logging Safety

### 5.1 No Secrets in Logs

NEVER log or print:

- Environment variable values
- Database connection strings
- API keys or tokens
- Passwords
- Private keys

### 5.2 Safe Logging

When logging for debugging:

```
WRONG:
  log.Printf("DB Password: %s", cfg.DB.Password)

RIGHT:
  log.Printf("Database configured: host=%s db=%s", cfg.DB.Host, cfg.DB.Name)
```

## Rule 6: Task Completion

### 6.1 Checkpoint System

Before marking any task as complete:

1. Create a checkpoint file in `.checkpoint/` directory
2. Use the format: `{sequence}_{git.user.name}_{task-description}.md`
3. Include what was done, what was verified, and what remains

### 6.2 Verification Checklist

Before completing any task:

- [ ] All code compiles/builds without errors
- [ ] No hardcoded credentials anywhere
- [ ] All placeholders use safe values
- [ ] Documentation updated if needed
- [ ] Checkpoint file created
- [ ] `git status` reviewed for unintended changes

### 6.3 Never Mark Incomplete Work

NEVER mark a task as complete if:

- There are compilation errors
- There are lint warnings that should be fixed
- Credentials are exposed
- Tests are failing
- Documentation is outdated

## Rule 7: Communication

### 7.1 Ask Before Acting

When unsure about something:

1. Ask the user for clarification
2. Do not assume or guess
3. Do not make changes that are not explicitly requested

### 7.2 Report Issues Immediately

If you discover:

- A credential in the codebase
- A security vulnerability
- A broken build
- A failing test

Report it immediately to the user.

### 7.3 No Surprises

NEVER make changes that the user did not ask for:

- Do not add features not requested
- Do not refactor unrelated code
- Do not update dependencies without approval
- Do not change configurations without approval

## Enforcement

These rules are enforced by:

1. Code review before merging
2. Automated CI checks
3. Manual verification
4. Checkpoint file review

Violations will result in:

- Task rejection
- Required rework
- Additional review
- Possible access restriction

## Questions

If you have any questions about these rules:

1. Ask the user
2. Refer to `ARCHITECTURE.md` for system understanding
3. Check existing code patterns
4. Do not make assumptions

## Rule 8: User Communication

### 8.1 Ask Before Implementing

Before implementing any feature or fix, ALWAYS ask the user for clarification:

- What exactly needs to be changed?
- What is the expected behavior?
- Are there any edge cases to consider?
- What testing approach should be used?

### 8.2 Request Detailed Requirements

When given a vague task, ask for specifics:

```
WRONG:
  User: "Fix the login"
  Agent: *starts making changes*

RIGHT:
  User: "Fix the login"
  Agent: "Can you clarify what's wrong with the login? For example:
          - Is it not accepting credentials?
          - Is there an error message?
          - Does it happen for all users or specific ones?
          - What browser/device are you using?"
```

### 8.3 Confirm Before Proceeding

Before making significant changes, summarize your understanding:

```
Agent: "Let me confirm my understanding:
        1. You want to add X feature
        2. It should work like Y
        3. The expected behavior is Z
        Is this correct? Should I proceed?"
```

### 8.4 Ask About Trade-offs

When there are multiple implementation options, ask the user to choose:

```
Agent: "There are two ways to implement this:
        Option A: [description] - pros/cons
        Option B: [description] - pros/cons
        Which approach would you prefer?"
```

### 8.5 Report Assumptions

If you must make assumptions, state them clearly:

```
Agent: "I'm assuming the following based on the codebase:
        - [assumption 1]
        - [assumption 2]
        If these are incorrect, please let me know before I proceed."
```
