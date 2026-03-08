---
name: research-first-decider
description: Use when the user wants any coding agent to turn a feature, tool, workflow, or product idea into an implementation path that first searches GitHub and adjacent open-source sources, evaluates reuse versus rewrite cost, and then chooses adapt, fork, borrow, or build from scratch.
---

# Research First Decider

Use this skill when the user wants to turn an idea into a practical implementation path and explicitly cares about cost, difficulty, reuse, and open-source leverage.

This workflow is agent-agnostic. It is not specific to OpenClaw. The same logic should work for Codex, Claude Code, Cursor agents, OpenHands-style agents, or any other coding assistant that can read repository instructions, a skill file, or a protocol document.

## Goal

Do not jump straight into implementation.

First decide whether the best path is:

1. Reuse with minimal integration
2. Fork and adapt
3. Borrow ideas but reimplement
4. Build from scratch

## Default Workflow

### 1. Normalize the request

Reduce the idea into four short statements:

- target user
- core job to be done
- required inputs and outputs
- constraints on cost, time, safety, and maintenance

If the user is vague, make a reasonable draft and label it as an assumption instead of blocking.

### 2. Search before building

Search GitHub first, then other adjacent primary sources only if needed.

Minimum discovery pass:

- direct keyword search for the idea
- adjacent category search
- search for libraries, CLIs, sidecars, and templates separately
- inspect license, maintenance activity, stars, issues, docs quality, and architecture fit

Do not stop at a single repo. Compare multiple candidates.

### 3. Build a candidate table

For each promising candidate, record:

- repo or source
- what part can be reused
- required changes
- integration risks
- maintenance risk
- license constraints
- estimated adaptation cost

Reject weak candidates explicitly.

### 4. Score reuse versus rewrite

Use a simple decision rule.

Adapt/Fork is preferred only when most of the following are true:

- the architecture already matches at least 60 percent of the needed shape
- license is acceptable
- the codebase is understandable in reasonable time
- the missing features are local, not foundational
- long-term maintenance is lower than a fresh build

Build from scratch is preferred when one or more of the following are true:

- the candidate solves the wrong problem and would need heavy surgery
- the repo is stale, risky, unlicensed, or poorly documented
- hidden coupling is likely to dominate cost
- user requirements are narrow enough that a clean new implementation is smaller

### 5. Produce a decision artifact

Always output:

- recommended path: reuse, fork, borrow ideas, or build
- why that path wins on cost and maintenance
- what to implement first
- what to defer

### 6. Only then implement

If the user wants execution, start with the smallest vertical slice that proves the decision was correct.

## Required Output Shape

Use this structure in responses unless the user requests another format:

1. Problem framing
2. Candidate sources
3. Reuse versus rewrite decision
4. Proposed implementation path
5. Risks and unknowns

## Heuristics

- Prefer boring architecture over clever architecture.
- Prefer isolated sidecars over invasive changes when the host system is unstable.
- Prefer adding a decision layer before building a large UI.
- Prefer new code when adaptation complexity is mostly hidden.
- Prefer a skill plus a small tool over a large product if the workflow is still changing.

## Anti-Patterns

Avoid these:

- implementing before looking for existing work
- assuming a popular repo is automatically the right base
- underestimating license and maintenance costs
- copying a large codebase when only the decision logic is reusable
- turning a process problem into a huge platform too early

## Agent Loading Modes

This workflow can be packaged in multiple forms:

1. As a skill in a skill-aware agent
2. As an `AGENTS.md` or similar repository instruction file
3. As a standalone protocol document pasted into an agent session

If the agent supports repository instruction files, prefer placing the protocol near the repo root so it is automatically applied.

## Deliverables This Skill Can Produce

- a research memo
- a comparison table
- a build versus borrow recommendation
- a Codex skill draft
- a software architecture spec
- a phased execution plan
