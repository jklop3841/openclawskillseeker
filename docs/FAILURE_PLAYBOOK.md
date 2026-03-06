# Failure Explanation Templates

Use these when a demo, install, or customer test does not complete cleanly.

## 1. Skill Not Found

Short version:

The requested skill slug is not currently available in the live registry.

Longer version:

OpenClaw Skill Center intentionally checks live registry availability before or during install. In this case, the upstream registry did not resolve the requested slug, so the install was blocked instead of pretending success.

## 2. Suspicious Skill Skipped

Short version:

The skill was detected as suspicious and skipped by default policy.

Longer version:

OpenClaw Skill Center is whitelist-first. Suspicious skills are not silently forced through. They are skipped unless an explicit unsafe mode is chosen on purpose.

## 3. Upstream Rate Limit

Short version:

The upstream registry was reachable, but it temporarily refused installation due to rate limiting.

Longer version:

This is not the same as a dead slug or a broken local install path. The sidecar retried automatically. If the limit persisted, the result was recorded as retriable rather than as a permanent install failure.

## 4. Verification Failed

Short version:

The install command returned, but the expected skill layout was not found where it should be.

Longer version:

OpenClaw Skill Center does not treat logs as proof. It verifies real on-disk evidence such as `SKILL.md`, `.clawhub/origin.json`, and `.clawhub/lock.json`. If those files are missing, verification fails even if the command output looked successful.

## 5. Why This Is Safer Than Direct Install

Short version:

Because the sidecar validates first, installs in isolation, and verifies the result before asking you to trust it.

Longer version:

Direct installation is fast, but it is easy to lose track of what landed where. OpenClaw Skill Center adds a controlled layer that makes installs explainable, auditable, and easier to roll into a safer workflow.
