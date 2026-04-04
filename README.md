# Trading Analyst

This repository currently includes the Sprint 1-3 baseline plus the Sprint 4 indicator-engine path:

- Sprint 1 foundation
- Sprint 2 shared contracts
- Sprint 3 crypto market-data baseline
- Sprint 4 indicator calculation, persistence, and read APIs

Agent execution policy lives in `AGENTS.md`.

## Stack

- Bun workspaces + Turborepo
- Next.js (`apps/web`)
- Fastify (`apps/api`)
- BullMQ (`apps/worker`)
- Drizzle + PostgreSQL (`packages/db`)
- Deterministic indicator calculations (`packages/indicators`)
- Market-data adapters (`packages/market-data`)
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
  indicators/
  market-data/
  shared-types/

infrastructure/
  docker/
```

## Getting Started

1. Copy `.env.development.example` to `.env.development` for local work.
2. Fill the required PostgreSQL credentials and connection URLs in `.env.development`.
3. Start PostgreSQL and Redis with Docker Compose.
4. Add `TWELVE_DATA_API_KEY` to enable the current crypto market-data ingestion path. The same Twelve Data account can be reused later when post-MVP stock adapters are added.
5. Use Bun `1.3.11` or newer.
6. Install dependencies with `bun install`.
7. Run the monorepo with `bun run dev`.

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

Infrastructure-backed integration tests are included for the database, API routes, and worker persistence/bootstrap flows.
Run them with PostgreSQL and Redis up plus `RUN_INFRA_TESTS=true`.

`packages/shared-types` is the source of truth for shared Sprint 2 contracts, including the minimal auth/session boundary for future API protection, plus schema validation.
For the current MVP, monitored timeframes are `1H` and `4H` only. Timeframes `5m`, `15m`, and `1D` are post-MVP.
`packages/indicators` now contains the reusable Sprint 4 indicator-engine calculations.
The worker now calculates and persists latest indicator snapshots alongside latest market-data snapshots.
`packages/market-data` is the Sprint 3 source of truth for normalized market-data ingestion.

Current read endpoints:
- `GET /market-snapshots/latest?assetId=...&timeframe=...`
- `GET /indicator-snapshots/latest?assetId=...&timeframe=...`

**Market data provider: Twelve Data.**
Twelve Data is the primary provider for the crypto MVP market-data path.
`TWELVE_DATA_API_KEY` is required for market-data ingestion.

Current MVP scope is crypto-first.
US stock support will be added post-MVP as a separate extension using the same Twelve Data account.
IDX stock support (BBCA, BBRI, and similar) will be added later via Sectors.app as a separate adapter.

**Binance is not used in this repository.**

Current external-provider implementation status through Sprint 4:
- Twelve Data: implemented for crypto OHLCV and latest-price ingestion
- CoinGecko, alternative.me, Bybit, and CryptoPanic: approved MVP providers, but not wired in the current codebase yet
- OpenAI: approved AI provider, but not wired in the current codebase yet
- WhatsApp API chat layer: target delivery channel, not implemented in the current codebase yet

Twelve Data plan requirements by phase:
- Sprint 1-4 foundations: Free tier — adequate for local validation of the current `1H` and `4H` crypto ingestion and indicator path
- Later expansion: upgrade only when asset count, polling frequency, or post-MVP scope requires it
- Real-time monitoring later: Pro-tier features are only relevant if the repo intentionally adopts WebSocket-driven monitoring in a later phase

The Phase 1 chat layer target is the WhatsApp API. That delivery layer is not implemented in the current codebase yet.

Infrastructure credentials are intentionally not hardcoded in the repository.
Local PostgreSQL values for `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `DATABASE_URL` must be defined through `.env.development`.
Production values should live in `.env.production` or in your VPS/process manager secret store, and they will usually differ from local development values.

Bun automatically loads `.env`, then `.env.development` or `.env.production` based on `NODE_ENV`, then `.env.local` with increasing precedence. Source: https://bun.sh/docs/runtime/environment-variables

## Git Hooks

Husky is enabled in this repository.

- `pre-commit` runs `bun run lint`, `bun run typecheck`, and `bun run test`

This means commit-time quality checks happen automatically before a commit is accepted. Build verification still runs in CI and remains part of the required validation commands.

## Local Infrastructure

Docker is expected for local PostgreSQL and Redis. In this WSL environment, Docker Desktop WSL integration must be enabled before `docker compose` commands will work.

If `bun` still resolves to the Windows-side installation inside WSL, prefer a native WSL Bun binary on your shell `PATH`.

The CI workflow provisions PostgreSQL and Redis services, runs `bun run db:migrate`, and then executes the full test suite with `RUN_INFRA_TESTS=true`.
