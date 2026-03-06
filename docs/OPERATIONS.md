# Operations

## Recommended flow

1. Run `doctor`.
2. Run `validate-skill calendar`.
3. Run `install-skill calendar --targetDir <isolated-dir>`.
4. Run `verify-pack-layout <isolated-dir> --verbose`.
5. Read the generated markdown report and CLI summary.

## Demo-safe pack

If you want a pack-level demo, keep it limited to `demo-safe`.

- Validate with `validate-pack demo-safe`
- Install with `install-pack demo-safe --targetDir <isolated-dir>`
- Verify with `verify-pack-layout <isolated-dir> --verbose`

## Reports

- Install reports are stored in `~/.openclaw-skill-center/reports`
- Update and rollback reports use the same location for auditability
