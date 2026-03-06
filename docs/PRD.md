# OpenClaw Skill Center PRD

## Goal

Ship a production-grade local sidecar that manages curated OpenClaw skills through a web UI and CLI without modifying OpenClaw core.

## Users

- Local OpenClaw operators who want safer curated installs.
- Windows-first users who may run OpenClaw via WSL2.
- Teams that want rollback and reporting before touching local agent behavior.

## Non-goals

- Hosted registry or cloud sync.
- Direct changes to OpenClaw source code.
- Automatic trust of third-party skills.

## v1 Features

- Doctor checks for Node, OpenClaw config, workspace, clawhub, and WSL.
- Local curated catalog loader.
- ClawHub CLI-backed registry adapter.
- Pack planning and install with whitelist-first validation.
- Snapshot backup before install or update.
- Rollback from recorded snapshots.
- Safe patching of `~/.openclaw/openclaw.json` to extend `skills.load.extraDirs`.
- Markdown reports for install, update, and rollback.
- Local web UI and CLI.
