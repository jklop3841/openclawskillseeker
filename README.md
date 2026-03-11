# OpenClaw Exoskeleton

Give OpenClaw a curated skill library, then expose only the skills it should read right now.

`OpenClaw Exoskeleton` is a local sidecar app for OpenClaw. It does not fork or modify OpenClaw core. Instead, it manages a curated local skill library, syncs a small active skill set into an OpenClaw-readable directory, and helps users install, attach, verify, and roll back safely.

## What it does

- Keeps a larger curated library outside OpenClaw core
- Activates only the skills or packs you choose right now
- Syncs active skills into a managed `active-skills` directory
- Patches OpenClaw config only when needed
- Verifies real files on disk instead of trusting logs alone
- Keeps starter registry installs available as an advanced path

## Product position

OpenClaw Exoskeleton is best understood as:

- a curated skill library
- an active-skills manager
- a safe attach tool for OpenClaw
- a sidecar, not an OpenClaw replacement

## Main user paths

### Managed local packs

This is the default path.

1. Open the app
2. Choose one managed pack or one managed skill
3. Enable it for OpenClaw
4. Restart OpenClaw
5. Test the newly active skill

Managed packs currently include:

- `demo-safe`
- `knowledge-work`
- `delivery-engine`
- `business-ops`
- `paper-factory`

### Starter online installs

These remain available for the shortest registry-backed starter path:

- `Install and attach Calendar`
- `demo-safe`

## Why active-skills matters

OpenClaw should not read every possible skill at once.

This app keeps a larger curated library in one place, but only syncs the small active set that should be visible right now. That keeps the product simpler for users and avoids unnecessary skill overload inside OpenClaw.

## Desktop app

Local preview:

```powershell
Set-Location D:\AI\backlup
npm install
npm run start:desktop
```

Installer output:

- `D:\AI\backlup\apps\desktop\release\OpenClaw-Exoskeleton-Setup.exe`

## Managed activation evidence

After a successful managed activation, you should see files like:

- `<activeRoot>\.clawhub\lock.json`
- `<activeRoot>\skills\<skill>\SKILL.md`
- `<activeRoot>\skills\<skill>\.clawhub\origin.json`

## Development

```powershell
npm install
npm run typecheck
npm test
npm run build
```

Packaged desktop validation:

```powershell
npm run dist:setup
npm run smoke:desktop-packaged
```

## Documentation

- [Quick Demo Guide](/D:/AI/backlup/docs/DEMO.md)
- [Quick Install Guide](/D:/AI/backlup/docs/QUICK_INSTALL.md)
- [Install Guide](/D:/AI/backlup/docs/INSTALL.md)
- [Operations](/D:/AI/backlup/docs/OPERATIONS.md)
- [One-Page Overview](/D:/AI/backlup/docs/ONE_PAGER.md)
- [GitHub Homepage Copy](/D:/AI/backlup/docs/GITHUB_HOME.md)
- [Sales Page Draft](/D:/AI/backlup/docs/SALES_PAGE.md)
- [Failure Explanation Templates](/D:/AI/backlup/docs/FAILURE_PLAYBOOK.md)
