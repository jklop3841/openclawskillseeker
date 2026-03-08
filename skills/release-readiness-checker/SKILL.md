---
name: release-readiness-checker
description: Decide whether something is ready to ship by checking scope completion, risks, test evidence, rollback readiness, and unresolved blockers.
---

# Release Readiness Checker

Use this skill when a team needs a go or no-go decision for release.

## Use this skill when

- a feature is close to launch
- someone asks "can we ship this?"
- release evidence is scattered or incomplete

## Required outputs

- readiness verdict
- blocking issues
- residual risks
- rollback expectations
- recommended ship / hold decision

## Workflow

1. Check whether scope and acceptance criteria are actually met.
2. Review available evidence: tests, manual verification, rollout notes.
3. Separate blockers from acceptable risk.
4. Verify rollback or recovery path exists.
5. End with a plain go or no-go decision.

## Guardrails

- Do not say ready just because work is "mostly done."
- Missing verification is a real risk, not a footnote.
- Be explicit when a release can proceed only with constraints.
