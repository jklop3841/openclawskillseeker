# Security

## Core principles

- Treat all third-party skills as untrusted code.
- Install only from a local curated allowlist.
- Snapshot before install, update, and config changes.
- Keep skill packs isolated from OpenClaw core directories.

## Review guidance

- Inspect each skill source before enabling secrets or write-capable tools.
- Prefer official or maintainer-reviewed skills first.
- Do not expose production credentials to skills that have not passed local review.

## Rollback

- Every install and update creates a snapshot before mutating pack directories.
- Rollback restores the previous config and pack contents from the snapshot manifest.
