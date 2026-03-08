---
name: ops-runbook-copilot
description: Turn a deployment, incident, or maintenance task into a step-by-step runbook with checks, rollback notes, and escalation points.
---

# Ops Runbook Copilot

Use this skill when an operations task needs a repeatable runbook instead of improvised commands.

## Use this skill when

- preparing a deployment checklist
- documenting an incident response flow
- defining a maintenance or recovery procedure

## Required outputs

- prerequisites
- ordered run steps
- success checks
- rollback or recovery steps
- escalation conditions

## Workflow

1. State the task objective and operating constraints.
2. List prerequisites before the first action.
3. Write steps in execution order, one action per step.
4. Add validation checks after risky transitions.
5. End with rollback and escalation guidance.

## Guardrails

- Do not hide destructive steps.
- Prefer explicit checks over assumed success.
- Escalate when uncertainty exceeds runbook confidence.
