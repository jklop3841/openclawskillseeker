# Architecture

## Sidecar model

OpenClaw Skill Center runs beside OpenClaw. It never patches or vendors OpenClaw core code. Integration happens through:

1. Reading `~/.openclaw/openclaw.json`
2. Using the official `clawhub` CLI
3. Writing curated skill packs into `~/.openclaw-skill-center/packs/<packId>`
4. Optionally adding those directories to `skills.load.extraDirs`

## Packages

- `packages/shared`: zod schemas and shared types.
- `packages/catalog`: local curated catalog and pack definitions.
- `packages/core`: doctor, snapshots, registry adapter, pack install/update, rollback, config patching, reports.
- `apps/cli`: operator CLI.
- `apps/web`: Express API plus React web UI.

## Data model

- State file: `~/.openclaw-skill-center/state.json`
- Snapshots: `~/.openclaw-skill-center/snapshots/<snapshotId>`
- Reports: `~/.openclaw-skill-center/reports/*.md`
- Pack roots: `~/.openclaw-skill-center/packs/<packId>`

## Trust model

- Local catalog is the allowlist.
- Any slug outside the catalog is blocked by default.
- Community entries can still be marked curated, but must be explicitly reviewed by the operator.
