# Architecture Decision Records

Each ADR captures one load-bearing architectural decision: what was decided,
why, and what alternatives were rejected — so future work doesn't
re-litigate settled questions or re-suggest options already ruled out for a
documented reason.

## When to add one

Add an ADR when a decision would otherwise be invisible to someone reading
the code later — especially rejections ("we considered X, chose Y because
Z"). Don't add one for decisions the code already makes obvious, or for
reasoning that's purely situational ("didn't have time").

## Format

Filename: `NNNN-short-title.md` (zero-padded sequence number).

```markdown
# NNNN. Title

Status: Accepted | Superseded by NNNN | Deprecated
Date: YYYY-MM-DD

## Context
What prompted this decision.

## Decision
What was decided.

## Alternatives considered
What else was on the table, and why it was rejected.

## Consequences
What this makes easier, harder, or forecloses.
```

No ADRs exist yet — this folder was created alongside `CONTEXT.md` to
support architecture review work (see `.claude/skills/improve-codebase-architecture`).
