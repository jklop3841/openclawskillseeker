# Agency Agents Adaptation Plan

## Purpose

This document translates selected agents from `msitarzewski/agency-agents` into a form that fits the current `OpenClaw Skill Center` model.

The goal is not to mirror that repository verbatim. The goal is to extract the reusable workflow value, remove prompt bloat, and define a realistic path toward curated installation in this repo.

## Source Snapshot

Reviewed on `2026-03-07`.

- Repository: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)
- License: MIT
- Current positioning in README:
  - Claude Code copy-to-directory workflow
  - optional use as reference
  - roster of specialist agents
- Relevant sources reviewed:
  - [README](https://github.com/msitarzewski/agency-agents)
  - [engineering/engineering-frontend-developer.md](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-frontend-developer.md)
  - [testing/testing-reality-checker.md](https://github.com/msitarzewski/agency-agents/blob/main/testing/testing-reality-checker.md)
  - [specialized/agents-orchestrator.md](https://github.com/msitarzewski/agency-agents/blob/main/specialized/agents-orchestrator.md)

## What This Repo Can Reuse

`agency-agents` is best treated as a content source, not as an executable framework.

Reusable parts:

- agent specialization boundaries
- repeatable workflow phases
- deliverable-oriented output structure
- explicit quality gates
- role-to-task routing hints

Parts to avoid importing directly:

- long personality prose
- toolchain-specific phrases such as "spawn agent"
- shell snippets tied to a different environment
- claims that assume a built-in multi-agent runtime

## Compatibility With Current OpenClaw Skill Center

Current repository behavior:

- catalog entries are curated skill records with `slug`, `name`, `description`, `tags`, and trust metadata
- packs are lists of slugs
- validation and install currently assume a live registry via `clawhub inspect` and `clawhub install`
- `verify-pack-layout` proves real filesystem evidence after install

Relevant local code:

- [packages/shared/src/schemas.ts](/D:/AI/backlup/packages/shared/src/schemas.ts)
- [packages/core/src/pack-service.ts](/D:/AI/backlup/packages/core/src/pack-service.ts)
- [packages/catalog/catalog/catalog.json](/D:/AI/backlup/packages/catalog/catalog/catalog.json)

Important constraint:

The current installer cannot ingest raw GitHub agent markdown files directly. It can only validate and install skills that exist in the connected registry.

That means `agency-agents` fits in one of two ways:

1. As a manual curation source for new first-party local skills.
2. As a future import source after adding a non-registry install mode.

## Candidate PoC Set

For a first proof of concept, use these three agents:

1. Frontend Developer
2. Reality Checker
3. Agents Orchestrator

Why these three:

- they cover implementation, validation, and coordination
- they align with your current product story around safe installs and auditable workflows
- they are easier to compress into deterministic skill instructions than the more marketing-heavy agents

## Skill-Creation Principles Applied

This adaptation follows the local `skill-creator` guidance:

- keep the core workflow, strip excess explanation
- convert personality into operational behavior
- push environment-specific details out of the core instructions
- keep trigger conditions explicit
- prefer concise deliverables over long examples

Reference used:

- [$skill-creator](C:\Users\Administrator\.codex\skills\.system\skill-creator\SKILL.md)

## Agent 1: Frontend Developer

Source intent:

- frontend implementation specialist
- responsive UI, accessibility, performance, component systems

What to keep:

- accessibility-first and performance-first defaults
- component architecture guidance
- concrete deliverables
- stepwise workflow from setup to QA

What to remove or compress:

- broad framework list repetition
- long illustrative code sample
- abstract identity and memory text
- claims that belong in docs, not in the skill body

Suggested local skill mapping:

- slug: `agency-frontend-developer`
- name: `Agency Frontend Developer`
- tags: `frontend`, `ui`, `accessibility`, `performance`
- trust level: `curated`
- initial status: reference-only until manually reviewed

Suggested `SKILL.md` shape:

```md
---
name: agency-frontend-developer
description: Implement accessible, responsive frontend work with explicit performance and QA gates. Use when building or refactoring UI code, component systems, or frontend delivery plans.
---

# Agency Frontend Developer

## Use this skill when

- the task is mainly UI or web frontend implementation
- responsiveness, accessibility, and performance matter
- the user needs concrete frontend deliverables rather than generic advice

## Required outputs

- implementation summary
- changed files
- accessibility checks performed
- performance risks or follow-ups

## Workflow

1. Inspect the existing frontend stack and constraints.
2. Choose the minimal implementation path that matches repo conventions.
3. Build mobile-first and keyboard-accessible UI.
4. Verify behavior with local tests or browser checks when available.
5. Report any remaining accessibility or performance risks explicitly.

## Guardrails

- Prefer semantic HTML before ARIA.
- Do not trade correctness for animation polish.
- Call out missing tests or unverifiable behavior.
```

Expected improvement:

- better consistency on frontend tasks
- stronger accessibility defaults
- less generic UI output

## Agent 2: Reality Checker

Source intent:

- final QA gate
- skeptical review
- evidence-based approval instead of optimistic claims

What to keep:

- default stance of `needs work` until evidence exists
- requirement to cross-check claims against artifacts
- focus on real user journeys
- explicit evidence requirements

What to remove or compress:

- repo-specific shell commands
- Laravel-specific assumptions
- exaggerated rhetoric
- fixed screenshot folder assumptions

Suggested local skill mapping:

- slug: `agency-reality-checker`
- name: `Agency Reality Checker`
- tags: `qa`, `evidence`, `release`, `verification`
- trust level: `curated`
- initial status: strong candidate for default-safe pack inclusion after review

Suggested `SKILL.md` shape:

```md
---
name: agency-reality-checker
description: Perform evidence-based readiness checks and block premature approval claims. Use when validating feature completeness, QA evidence, or release readiness.
---

# Agency Reality Checker

## Use this skill when

- a task is claimed complete and needs verification
- release readiness is under discussion
- visual or end-to-end evidence matters

## Required outputs

- verdict: `pass`, `needs work`, or `blocked`
- evidence reviewed
- mismatches between claims and implementation
- concrete next fixes

## Workflow

1. Verify what was actually changed in code and assets.
2. Compare claimed behavior against observable evidence.
3. Check at least one full user journey where possible.
4. Refuse production-ready language without supporting evidence.
5. Return a short remediation list.

## Guardrails

- Default to `needs work` if evidence is missing.
- Distinguish missing evidence from confirmed failure.
- Avoid inflated quality scores.
```

Expected improvement:

- fewer false-positive approvals
- better bug reproduction discipline
- stronger audit trail for demos and release checks

## Agent 3: Agents Orchestrator

Source intent:

- pipeline coordinator
- handoff manager across planning, implementation, QA, and integration
- retry-loop enforcer

What to keep:

- phase-driven execution
- clear handoffs
- retry limits
- progress tracking
- no advancement without quality gates

What to remove or compress:

- "spawn agent" wording
- hardcoded project directory names
- assumptions about parallel agent runtime
- verbose persona copy

Suggested local skill mapping:

- slug: `agency-orchestrator`
- name: `Agency Orchestrator`
- tags: `workflow`, `coordination`, `delivery`, `quality-gates`
- trust level: `curated`
- initial status: reference-only until a local execution model exists

Suggested `SKILL.md` shape:

```md
---
name: agency-orchestrator
description: Coordinate multi-phase delivery with explicit handoffs and QA gates. Use when a task requires planning, implementation, verification, and tracked retries across multiple work streams.
---

# Agency Orchestrator

## Use this skill when

- a request spans planning, implementation, and QA
- there are multiple distinct roles or workstreams
- quality gates need to be enforced between phases

## Required outputs

- current phase
- handoff summary
- blockers and retry count
- completion criteria per phase

## Workflow

1. Break the request into phases and artifacts.
2. Define entry and exit criteria for each phase.
3. Run implementation and QA as a loop, not as independent steps.
4. Escalate after repeated failure instead of hiding it.
5. Finish with a final readiness summary.

## Guardrails

- No phase advancement without verification.
- Keep handoff context short and concrete.
- Record assumptions and unresolved blockers.
```

Expected improvement:

- clearer task decomposition
- better status reporting
- fewer skipped verification steps in complex work

## Proposed PoC Pack

This is the first pack worth prototyping conceptually:

- pack id: `agency-poc`
- skills:
  - `agency-frontend-developer`
  - `agency-reality-checker`
  - `agency-orchestrator`

Pack intent:

- demonstrate one implementation role
- demonstrate one hard QA gate
- demonstrate one coordination role

## Recommended Adaptation Strategy

### Phase 1: Reference Import

Do this now without changing installer architecture:

- keep this document as the evaluation record
- create local draft `SKILL.md` files outside the live catalog
- manually compare the draft skills with real tasks

### Phase 2: Local Curated Skill Source

Add support for a local curated source mode:

- add catalog support for `sourceType`
  - `registry`
  - `local`
  - `github-reference`
- allow packs to include non-registry skills
- verify local-origin metadata similarly to `.clawhub/origin.json`

### Phase 3: Controlled GitHub Import

Only after the local source path exists:

- import a pinned GitHub commit or raw file snapshot
- record source repo, path, commit SHA, and license
- run a transformation step that converts agent markdown into compact `SKILL.md`
- require manual review before inclusion in curated packs

## Minimal Schema Direction

Not implemented yet, but likely needed:

```ts
type CatalogSkill = {
  slug: string;
  name: string;
  description: string;
  trustLevel: "official" | "curated" | "community";
  sourceType?: "registry" | "local" | "github-reference";
  sourceRef?: {
    repo?: string;
    path?: string;
    commit?: string;
    license?: string;
  };
};
```

This would let the product distinguish:

- live registry skills
- local first-party curated skills
- imported external reference material

## What Not To Do

- do not copy the whole repository into the catalog
- do not preserve long personality sections unchanged
- do not advertise support for autonomous multi-agent execution before the runtime exists
- do not treat a GitHub markdown file as a trusted install artifact without review

## Practical Recommendation

Near term:

- adapt the three selected agents into local draft skills
- test them manually against real tasks
- keep them out of the live install catalog until local-source support exists

Medium term:

- extend the schema and install path to support curated local skills
- then ship `agency-poc` as a demonstrable pack

This path keeps the current safety story intact:

- isolated installs
- explicit provenance
- whitelist-first policy
- verifiable filesystem evidence
