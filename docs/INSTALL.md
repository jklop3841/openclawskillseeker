# Install Guide

## Requirements

- Node 22+
- OpenClaw installed separately
- Official `clawhub` CLI installed

## Windows PowerShell Recommendation

Use explicit binary path first:

```powershell
C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd
```

## Setup

1. Run `npm install`
2. Run `npm run build`
3. Run `npx tsx apps\cli\src\index.ts doctor --clawhub-bin C:\Users\Administrator\AppData\Roaming\npm\clawhub.cmd`
4. Follow the golden-path demo in [DEMO.md](/D:/AI/backlup/docs/DEMO.md)

## Windows note

- If OpenClaw itself runs inside WSL2, prefer running this sidecar in the same environment.
- WSL mount paths like `/mnt/c/...` are normalized when running on Windows.
