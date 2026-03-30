# AGENTS.md

This file defines the execution rules for any coding agent working in this repository.

## Purpose

This repository is for the **AI Trading Analyst Dashboard**.

Before making product or engineering decisions, read these files first:

1. `architecture.md`
2. `sprints.md`
3. `AGENTS.md`

`architecture.md` is the product and system direction.
`sprints.md` is the delivery sequence.
`AGENTS.md` is the execution policy for implementation work.

## Current Stack Baseline

Phase 1 implementation should follow these decisions unless the user explicitly changes them:

- Bun workspaces
- Turborepo
- Next.js for `apps/web`
- Fastify for `apps/api`
- BullMQ for `apps/worker`
- Drizzle for database access
- PostgreSQL as the main database
- Redis for queues and short-lived coordination
- Docker Compose for local PostgreSQL and Redis

The database approach is **SQL-first**:

- use Drizzle as the default database layer
- prefer clear SQL-shaped queries
- use raw/manual SQL when it is simpler or more performant
- avoid unnecessary repository abstractions

## Execution Rules

When implementing work:

- follow the sprint order in `sprints.md` unless the user explicitly reprioritizes
- keep code changes aligned with the current sprint scope
- do not silently introduce major stack changes
- update documentation when implementation changes the plan, contracts, or operating assumptions
- do not mark work complete without running the relevant validation commands

## Commit Message Convention

All commits in this repository should use **Conventional Commits** style.

Preferred format:

- `type(scope): short description`

Scope is preferred but can be omitted when it does not add value:

- `type: short description`

### Allowed Types

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`
- `build`
- `ci`
- `perf`

### Commit Message Rules

- use lowercase commit types
- keep the subject short and clear
- use imperative wording
- do not end the subject with a period
- use scope when it helps identify the area changed

### Examples

- `feat(api): add watchlist overview endpoint`
- `fix(worker): handle redis reconnect on startup`
- `refactor(db): simplify raw query helper`
- `test(api): add health route integration test`
- `docs(agents): define commit message convention`
- `chore(repo): add husky hooks`

## Code Style and Engineering Standards

All code in this repository should aim for:

- best practice
- type safety
- modular design
- shared and reusable building blocks
- security
- performance
- simplicity
- readability
- documentation

These are not optional preferences. They are the default implementation standard.

### Best Practice

- follow current stable best practices for the chosen stack
- prefer framework-native patterns over clever custom abstractions
- avoid outdated patterns, dead code, and speculative architecture
- keep route handlers, workers, and UI layers thin; move business logic into reusable modules

### Type Safety

- prefer explicit types and validated boundaries
- avoid `any` unless there is a strong reason and it is clearly contained
- validate env vars, request payloads, query params, and external provider responses
- keep shared contracts in shared packages when multiple apps depend on them
- use schema validation at boundaries and typed domain objects inside the app

### Modular Design

- organize code by responsibility, not by convenience alone
- keep functions focused and modules small enough to understand quickly
- separate transport concerns, domain logic, persistence, and integration code
- avoid large files that mix unrelated responsibilities

### Shared and Reusable Style

- do not duplicate logic, types, utilities, or components when they can be shared cleanly
- when the same behavior appears in more than one place, prefer extracting a shared primitive
- reuse shared types, helper functions, validation schemas, and UI building blocks
- only abstract when the shared shape is real; avoid premature abstractions

### Security

- treat all external input as untrusted
- validate and sanitize inputs at every boundary
- never hardcode secrets or tokens
- do not log sensitive values
- use parameterized queries for SQL
- when using raw SQL, never build queries through unsafe string interpolation with user input
- keep permissions and side effects explicit

### Performance

- prefer simple designs first, then optimize hot paths deliberately
- avoid unnecessary database round trips, repeated work, and obvious N+1 patterns
- keep payloads and queries focused on what is needed
- prefer efficient shared logic over repeated recomputation
- do not sacrifice readability for micro-optimizations without evidence

### Simplicity

- choose the simplest solution that correctly solves the problem
- avoid adding layers, patterns, or abstractions without a clear need
- keep control flow explicit and predictable
- remove complexity when it does not buy clarity or capability

### Readability

- use clear names
- prefer straightforward logic over compact clever code
- keep nesting and branching under control
- write code so another engineer can understand it quickly
- add comments only when they explain intent, constraints, or non-obvious reasoning

### Documentation

- document public contracts, important behaviors, setup changes, and non-obvious decisions
- update Markdown docs when architecture, workflow, environment, or delivery assumptions change
- document tricky logic close to the code when a future reader would otherwise have to reverse-engineer intent

### Additional Preferences for This Repository

- prefer composition over inheritance
- prefer pure functions for domain logic where practical
- prefer explicit error handling over silent failure
- keep API and worker behavior observable through logs and clear statuses
- keep shared foundations stable so web, api, and worker do not drift in style or contract shape

## Test Policy

Every feature, behavior change, or bug fix must include automated tests.

This is a hard rule for this repository.

If code changes but no test changes are needed, the agent must be able to explain why.

### Required Testing Rule

No feature is considered complete unless all of the following are true:

- the implementation is in place
- relevant automated tests are added or updated
- lint passes
- typecheck passes
- tests pass
- build passes when the affected area has a build step

### Test Selection Guide

Choose the test type based on the kind of change:

- **Unit tests** for pure logic
- **Integration tests** for boundaries between modules and services
- **Contract/schema tests** for typed interfaces and structured outputs
- **End-to-end tests** for major user flows once those flows exist
- **Regression tests** for bug fixes

### What Should Usually Be Unit Tested

- indicator calculations
- rules-engine decisions
- asset-state derivation
- confidence and scoring logic
- parsers and command normalization
- utility functions

### What Should Usually Be Integration Tested

- Fastify routes
- request validation and response shape
- database queries and migrations
- Drizzle schema behavior
- market data adapters
- BullMQ job handlers
- alert generation flows
- AI prompt-builder and output validation boundaries

### What Should Usually Get End-to-End Coverage Later

- watchlist overview flow
- asset detail flow
- manual position record flow
- alert feed flow
- chat-triggered record/update flow

## Bug Fix Rule

Every bug fix should include a regression test that fails before the fix and passes after the fix whenever reasonably possible.

If a regression test is not practical, the agent must state the reason clearly.

## Documentation Rule

Update docs when code changes any of these:

- architecture assumptions
- stack decisions
- contracts or schemas
- setup steps
- environment requirements
- sprint scope or delivery expectations

## Validation Commands

Use these repo-level commands as the standard baseline:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

Database-related commands:

- `bun run db:generate`
- `bun run db:migrate`

These validations are also enforced through Husky hooks:

- `pre-commit` runs lint, typecheck, and tests
- `pre-push` runs build

## Environment Notes

- use Bun `1.3.11` or newer
- prefer a native WSL/Linux Bun binary when working inside WSL
- Docker Desktop WSL integration must be enabled before local `docker compose` can run in this environment

## Definition of Done

Implementation work is only done when:

- code is implemented
- tests are added or updated
- validation commands have been run for the affected scope
- blockers or unverified areas are stated explicitly
- relevant docs are updated when needed

If one of those is missing, the work is not done.
