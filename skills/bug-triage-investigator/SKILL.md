---
name: bug-triage-investigator
description: Triage a bug report into symptoms, likely causes, repro plan, evidence needed, and fix priority before implementation starts.
---

# Bug Triage Investigator

Use this skill when a bug is reported but the root cause is still unclear.

## Use this skill when

- the issue report is vague or noisy
- reproduction steps are incomplete
- you need severity and next actions before coding

## Required outputs

- symptom summary
- likely failure surface
- reproduction checklist
- evidence still needed
- severity and priority recommendation

## Workflow

1. Separate observed symptoms from guesses.
2. Define the smallest reproducible path.
3. List the most likely failure surfaces.
4. Ask for or collect evidence that reduces uncertainty fastest.
5. End with a recommended next debugging move.

## Guardrails

- Do not claim a root cause without evidence.
- Keep severity tied to user impact, not drama.
- Prefer a short repro path over a broad theory.
