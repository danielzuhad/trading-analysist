# Trading Analyst

Sprint 1 foundation for the AI Trading Analyst Dashboard.

Agent execution policy lives in `AGENTS.md`.

## Stack

- Bun workspaces + Turborepo
- Next.js (`apps/web`)
- Fastify (`apps/api`)
- BullMQ (`apps/worker`)
- Drizzle + PostgreSQL (`packages/db`)
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

## Commands

- `bun run dev` to run all apps
- `bun run build` to build the workspace
- `bun run lint` to lint all packages
- `bun run typecheck` to type-check all packages
- `bun run test` to run tests
- `bun run db:generate` to generate Drizzle migrations
- `bun run db:migrate` to run Drizzle migrations

## Local Infrastructure

Docker is expected for local PostgreSQL and Redis. In this WSL environment, Docker Desktop WSL integration must be enabled before `docker compose` commands will work.

If `bun` still resolves to the Windows-side installation inside WSL, prefer a native WSL Bun binary on your shell `PATH`.
