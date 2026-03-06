# Quick Demo Guide

This guide freezes the smallest safe demo for OpenClaw Skill Center.

## Scope

- Single skill demo: `calendar`
- Minimal pack demo: `demo-safe`
- Installation target: isolated local directory
- OpenClaw core remains unchanged

## Golden Path

Windows PowerShell:

```powershell
Set-Location D:\AI\backlup

npx tsx apps\cli\src\index.ts validate-skill calendar --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd

Remove-Item D:\temp\openclaw-skill-center\calendar -Recurse -Force -ErrorAction SilentlyContinue

npx tsx apps\cli\src\index.ts install-skill calendar --targetDir D:\temp\openclaw-skill-center\calendar --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd

npx tsx apps\cli\src\index.ts verify-pack-layout D:\temp\openclaw-skill-center\calendar --verbose
```

## What To Show

1. `validate-skill calendar` proves the slug exists before installation.
2. `install-skill calendar` installs into an isolated sidecar directory.
3. `verify-pack-layout --verbose` proves the expected files are present.

Expected evidence:

- `D:\temp\openclaw-skill-center\calendar\.clawhub\lock.json`
- `D:\temp\openclaw-skill-center\calendar\skills\calendar\SKILL.md`
- `D:\temp\openclaw-skill-center\calendar\skills\calendar\.clawhub\origin.json`

## Optional Pack Demo

```powershell
Remove-Item D:\temp\openclaw-skill-center\demo-safe -Recurse -Force -ErrorAction SilentlyContinue

npx tsx apps\cli\src\index.ts validate-pack demo-safe --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd
npx tsx apps\cli\src\index.ts install-pack demo-safe --targetDir D:\temp\openclaw-skill-center\demo-safe --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd
npx tsx apps\cli\src\index.ts verify-pack-layout D:\temp\openclaw-skill-center\demo-safe --verbose
```

## Talking Points

- OpenClaw Skill Center is a sidecar, not a fork of OpenClaw.
- Default behavior is whitelist-first.
- Installation is isolated and auditable.
- Success is proven by real files, not by logs alone.
