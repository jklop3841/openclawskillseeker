# OpenClaw Skill Center

OpenClaw Skill Center is a local sidecar for safer OpenClaw skill installs.

It does not modify OpenClaw core. It validates curated skills, installs them into isolated directories, and verifies real on-disk evidence before you point OpenClaw at those skills.

## Why It Exists

Installing third-party OpenClaw skills directly is fast, but it is also easy to lose track of:

- what was installed
- where files landed
- whether a skill was skipped for safety reasons
- whether installation actually produced a valid `SKILL.md` layout

OpenClaw Skill Center adds a controlled sidecar layer around that process.

## Positioning

- Sidecar: separate from OpenClaw core
- Whitelist-first: suspicious skills are skipped by default
- Local-first: local JSON state, local snapshots, local reports
- Auditable: install results are proven by real files, not by logs alone
- Windows-friendly: explicit `clawhub.cmd` support with WSL-aware bridge

## Current Status

`v0.3.0-demoable-safe`

This version freezes one proven golden path:

- Single skill: `calendar`
- Minimal pack: `demo-safe`

Golden path:

1. `validate-skill calendar`
2. `install-skill calendar`
3. `verify-pack-layout --verbose`

## What It Proves

This prototype already proves four core claims:

1. It does not modify OpenClaw core.
2. It installs into an isolated target directory.
3. It keeps a whitelist-first safety posture.
4. It can verify the resulting filesystem layout.

## Minimal Demo

Windows PowerShell:

```powershell
Set-Location D:\AI\backlup

npx tsx apps\cli\src\index.ts validate-skill calendar --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd

Remove-Item D:\temp\openclaw-skill-center\calendar -Recurse -Force -ErrorAction SilentlyContinue

npx tsx apps\cli\src\index.ts install-skill calendar --targetDir D:\temp\openclaw-skill-center\calendar --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd

npx tsx apps\cli\src\index.ts verify-pack-layout D:\temp\openclaw-skill-center\calendar --verbose
```

## Successful Install Evidence

Expected evidence under the isolated target directory:

- `<targetDir>\.clawhub\lock.json`
- `<targetDir>\skills\calendar\SKILL.md`
- `<targetDir>\skills\calendar\.clawhub\origin.json`

## Who This Is For

- OpenClaw users who want safer local skill installs
- Windows users running with explicit `clawhub.cmd`
- Builders who need a demonstrable sidecar prototype before investing in a larger UI or catalog

## What This Is Not Yet

- Not a hosted registry
- Not a cloud sync product
- Not a full multi-pack commercial suite
- Not a replacement for OpenClaw itself

## Reports

Install reports are written to:

- `~/.openclaw-skill-center/reports`

CLI install commands also print a short human-readable summary:

- what was installed
- what was skipped
- why anything was skipped
- where files were written
- how to verify success

## Docs

- [Quick Demo Guide](/D:/AI/backlup/docs/DEMO.md)
- [Install Guide](/D:/AI/backlup/docs/INSTALL.md)
- [Operations](/D:/AI/backlup/docs/OPERATIONS.md)
- [One-Page Overview](/D:/AI/backlup/docs/ONE_PAGER.md)
- [GitHub Homepage Copy](/D:/AI/backlup/docs/GITHUB_HOME.md)
- [Failure Explanation Templates](/D:/AI/backlup/docs/FAILURE_PLAYBOOK.md)

## Development

```powershell
npm install
npm run typecheck
npm test
npm run build
```
