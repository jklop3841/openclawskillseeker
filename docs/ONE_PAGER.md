# OpenClaw Skill Center One-Page Overview

## What It Is

OpenClaw Skill Center is a local sidecar that makes OpenClaw skill installs safer, easier to explain, and easier to verify.

It sits next to OpenClaw, not inside it.

## Core Promise

Instead of telling users to install arbitrary skills directly into their OpenClaw environment, OpenClaw Skill Center gives them a controlled path:

1. validate a skill
2. install it into an isolated directory
3. verify the exact filesystem evidence

## Why It Matters

OpenClaw skills are powerful, but third-party skills are still code-like assets with access to tools and context.

The safest product posture is not "install everything faster." The safest posture is:

- curate first
- skip suspicious by default
- install in isolation
- verify real files
- keep reports

## Current Demo Scope

Frozen around one proven path:

- `calendar`
- `demo-safe`

Windows PowerShell demo:

```powershell
npx tsx apps\cli\src\index.ts validate-skill calendar --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd
npx tsx apps\cli\src\index.ts install-skill calendar --targetDir D:\temp\openclaw-skill-center\calendar --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd
npx tsx apps\cli\src\index.ts verify-pack-layout D:\temp\openclaw-skill-center\calendar --verbose
```

## What The Demo Proves

- OpenClaw core is untouched
- install happens in an isolated target directory
- success is verified by `SKILL.md`, `origin.json`, and `lock.json`
- the system is whitelist-first by default

## Best Current Use

- demo to potential customers
- pre-sale validation
- GitHub showcase
- internal trust-building artifact

## Best Message To Users

"This is not a giant OpenClaw replacement. It is a safer install sidecar for curated skills."
