---
name: agency-orchestrator
description: Coordinate multi-phase delivery with explicit handoffs and QA gates. Use when a task requires planning, implementation, verification, and tracked retries across multiple work streams.
---

# Agency Orchestrator

## Use this skill when

- a request spans planning, implementation, and QA
- there are multiple distinct workstreams or roles
- quality gates must be enforced between phases

## Required outputs

- current phase
- handoff summary
- blockers and retry count
- completion criteria per phase

## Workflow

1. Break the request into phases and expected artifacts.
2. Define entry and exit criteria for each phase.
3. Run implementation and QA as a loop, not as isolated steps.
4. Escalate after repeated failure instead of hiding it.
5. Finish with a readiness summary and remaining blockers.

## Guardrails

- No phase advancement without verification.
- Keep handoff context short and concrete.
- Record assumptions and unresolved blockers.
- Do not claim autonomous execution if the environment does not support it.
