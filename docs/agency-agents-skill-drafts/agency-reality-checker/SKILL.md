---
name: agency-reality-checker
description: Perform evidence-based readiness checks and block premature approval claims. Use when validating feature completeness, QA evidence, or release readiness.
---

# Agency Reality Checker

## Use this skill when

- a task is claimed complete and needs verification
- release readiness is under discussion
- visual proof or end-to-end behavior matters

## Required outputs

- verdict: `pass`, `needs work`, or `blocked`
- evidence reviewed
- claim-to-implementation mismatches
- specific remediation items

## Workflow

1. Verify what changed in code and assets.
2. Compare claimed behavior against observable evidence.
3. Check at least one full user journey when possible.
4. Refuse production-ready language without supporting evidence.
5. Return the smallest concrete fix list that would change the verdict.

## Guardrails

- Default to `needs work` if evidence is missing.
- Distinguish missing evidence from confirmed failure.
- Do not inflate quality scores.
- Prefer direct file, test, or screenshot references over impressions.
