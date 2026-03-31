# Trading Analyst

Sprint 1 foundation for the AI Trading Analyst Dashboard.

Agent execution policy lives in `AGENTS.md`.

## Stack

- Bun workspaces + Turborepo
- Next.js (`apps/web`)
- Fastify (`apps/api`)
- BullMQ (`apps/worker`)
- Drizzle + PostgreSQL (`packages/db`)
- Zod-backed shared domain contracts (`packages/shared-types`)
- Biome for linting/formatting
- Vitest for testing

## Workspace Layout

```text
apps/
  web/
  api/
  worker/

packages/
  db/
  shared-types/

infrastructure/
  docker/
```

## Getting Started

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis with Docker Compose.
3. Use Bun `1.3.11` or newer.
4. Install dependencies with `bun install`.
5. Run the monorepo with `bun run dev`.

To start the local infrastructure:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

## Commands

- `bun run dev` to run all apps
- `bun run build` to build the workspace
- `bun run lint` to lint all packages
- `bun run typecheck` to type-check all packages
- `bun run test` to run tests
- `bun run db:generate` to generate Drizzle migrations
- `bun run db:migrate` to run Drizzle migrations

Infrastructure-backed integration tests are included for the database, API readiness route, and worker bootstrap.
Run them with PostgreSQL and Redis up plus `RUN_INFRA_TESTS=true`.

`packages/shared-types` is the source of truth for shared Sprint 2 contracts and schema validation.

## Git Hooks

Husky is enabled in this repository.

- `pre-commit` runs `bun run lint`, `bun run typecheck`, and `bun run test`

This means commit-time quality checks happen automatically before a commit is accepted. Build verification still runs in CI and remains part of the required validation commands.

## Local Infrastructure

Docker is expected for local PostgreSQL and Redis. In this WSL environment, Docker Desktop WSL integration must be enabled before `docker compose` commands will work.

If `bun` still resolves to the Windows-side installation inside WSL, prefer a native WSL Bun binary on your shell `PATH`.

The CI workflow provisions PostgreSQL and Redis services, runs `bun run db:migrate`, and then executes the full test suite with `RUN_INFRA_TESTS=true`.
