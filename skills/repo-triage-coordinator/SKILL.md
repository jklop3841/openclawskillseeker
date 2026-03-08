---
name: repo-triage-coordinator
description: Organize incoming repository work into bugs, enhancements, docs, chores, and release blockers with a clear priority recommendation.
---

# Repo Triage Coordinator

Use this skill when backlog items, issues, or incoming requests need quick categorization and ordering.

## Use this skill when

- the queue is messy
- priorities are unclear
- someone needs a defensible triage pass

## Required outputs

- item classification
- urgency
- user impact
- recommended owner type
- next action

## Workflow

1. Classify each item by type and user impact.
2. Separate blockers from routine maintenance.
3. Recommend an owner role, not necessarily a named person.
4. Mark items that should be closed, merged, deferred, or clarified.
5. End with a short priority order.

## Guardrails

- Do not mark everything high priority.
- Distinguish user pain from internal neatness work.
- Prefer fewer, clearer buckets over a complex taxonomy.
