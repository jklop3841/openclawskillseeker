# GitHub Homepage Copy

## Short Description

Safer local sidecar for curated OpenClaw skill installs.

## Tagline Options

- Validate, install, and verify OpenClaw skills without touching OpenClaw core.
- A whitelist-first sidecar for isolated OpenClaw skill installs.
- Safer curated OpenClaw skill installs with real filesystem verification.

## Repo Intro

OpenClaw Skill Center is a Windows-friendly local sidecar for managing curated OpenClaw skills.

It does not modify OpenClaw core. Instead, it validates skills, installs them into isolated directories, writes local reports, and verifies real installation evidence such as `SKILL.md`, `.clawhub/origin.json`, and `.clawhub/lock.json`.

Current stable demo path:

- `validate-skill calendar`
- `install-skill calendar`
- `verify-pack-layout --verbose`

## Proof Points

- sidecar architecture
- whitelist-first defaults
- suspicious skills skipped by default
- explicit `clawhub.cmd` support on Windows
- strict post-install verification

## Suggested README Opening

OpenClaw Skill Center is a local sidecar for safer OpenClaw skill installs. It validates curated skills, installs them into isolated directories, and verifies real filesystem evidence before you add those skills to your OpenClaw environment.

## Suggested Demo Caption

This demo shows a real `calendar` skill install into an isolated directory, followed by strict verification of `SKILL.md`, `origin.json`, and `lock.json`, without modifying OpenClaw core.
