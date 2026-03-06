# OpenClaw Skill Center Sales Page Draft

## Headline

Safer OpenClaw skill installs, without touching OpenClaw core.

## Subheadline

OpenClaw Skill Center is a local sidecar that validates curated skills, installs them into isolated directories, and verifies real on-disk evidence before you trust the result.

## Problem

Direct skill installation is quick, but it creates three immediate problems:

- you do not always know what actually got installed
- you do not always know where the files landed
- you do not always have a clean verification step after the install finishes

## Solution

OpenClaw Skill Center adds a controlled install layer around OpenClaw skills:

1. validate the skill first
2. install it into an isolated target directory
3. verify `SKILL.md`, `.clawhub/origin.json`, and `.clawhub/lock.json`

## Core Claims

- Sidecar, not a fork
- Whitelist-first by default
- Isolated install paths
- Human-readable install summaries
- Strict post-install verification

## Current Proven Demo

Verified golden path:

- `validate-skill calendar`
- `install-skill calendar`
- `verify-pack-layout --verbose`

What this proves:

- OpenClaw core remains untouched
- the install can succeed in a separate directory
- success is proven by real filesystem artifacts
- the flow is explainable to non-technical users

## Best Fit

- OpenClaw users who want safer installs
- consultants or builders demoing a controlled OpenClaw workflow
- early customers who need trust before automation

## Demo Caption

"This demo shows a real `calendar` skill install into an isolated directory, followed by strict verification of `SKILL.md`, `origin.json`, and `lock.json`, without modifying OpenClaw core."

## Short Pitch

OpenClaw Skill Center does not try to replace OpenClaw. It makes curated skill installs safer, more auditable, and easier to explain.

## Suggested Visual Structure

Section 1:
- Headline
- One-line value proposition

Section 2:
- Problem: direct install is fast but opaque
- Solution: validate, isolate, verify

Section 3:
- Screenshot or terminal output of:
  - `validate-skill calendar`
  - `install-skill calendar`
  - `verify-pack-layout --verbose`

Section 4:
- Trust points:
  - does not modify OpenClaw core
  - whitelist-first
  - auditable files on disk

Section 5:
- CTA:
  - request demo
  - try the local prototype
