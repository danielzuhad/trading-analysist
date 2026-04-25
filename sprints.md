# AI Trading Analyst Dashboard — Sprint Roadmap

## Roadmap Rule

Development must follow the sprint order unless the user explicitly reprioritizes.

Current implementation checkpoint for this repository:

- [x] Sprints 1-8 are implemented in the codebase
- [ ] Sprint 9 is the next active target

## Phase 1 — Crypto MVP

### [x] Sprint 1 — Foundation Setup

**Status**

Completed in codebase. Monorepo foundation, app bootstrap, Docker local infra, and repo validation commands are in place.

**Goal**

Set up the monorepo and local development baseline.

**Locked stack**

- Bun workspaces
- Turborepo
- Next.js for `apps/web`
- Fastify for `apps/api`
- BullMQ for `apps/worker`
- Drizzle for database access
- PostgreSQL
- Redis
- Docker Compose for local infrastructure

**Output**

- repo runs locally
- API, worker, and web app bootstrap correctly
- PostgreSQL and Redis are connected
- lint, typecheck, test, and build commands exist

### [x] Sprint 2 — Domain Models and Core Contracts

**Status**

Completed in codebase. Shared contracts, state vocabulary, validation schemas, and AI audit fields are defined.

**Goal**

Define the shared domain contracts before deeper implementation starts.

**Required contracts**

- `Asset`
- `MarketSnapshot`
- `IndicatorSnapshot`
- `AssetAnalysis`
- `AssetStateTransition`
- `UserWatchlist`
- `UserPreference`
- `Position`
- `Alert`
- `ExecutionRecord`
- minimal auth/session contract for API protection

**Required `AssetAnalysis` fields**

- `signal_strength_score`
- `ai_confidence`
- `model_used`
- `prompt_version`
- `snapshot_hash`
- `ai_latency_ms`
- `cost_estimate_usd`

**Output**

- shared contracts are stable
- state model and suggestion vocabulary are defined
- analysis contracts are audit-ready before the AI engine is built

### [x] Sprint 3 — Market Data Ingestion

**Status**

Completed in codebase. CoinGecko crypto ingestion, normalization, persistence, and latest market snapshot read path are implemented.

**Goal**

Fetch crypto market data and normalize it into one internal schema.

**MVP scope**

- crypto only
- `4H` only
- internal/private validation for BTC, ETH, and SOL first

**Provider decisions**

- crypto OHLCV, current price, and market context: CoinGecko
- sentiment: alternative.me Fear & Greed Index
- derivatives: Bybit public REST API

**Hard rules**

- Binance is out of scope and must not be used
- stock ingestion is post-MVP
- do not implement `5M`, `15M`, or `1D` in the MVP ingestion path

**Output**

- normalized crypto candle series and latest market snapshot
- env and runtime wiring for CoinGecko
- provider selection aligned with the crypto-first MVP

## Phase 1 — Current Progress and Next Steps

These sprints reflect what is already implemented and what comes next.

### [x] Sprint 4 — Indicator Engine

**Status**

Completed in codebase. Indicator calculation, persistence, and API read access are implemented.

**Goal**

Compute deterministic technical signals.

**Scope**

- EMA 20 / 50 / 200
- RSI
- ATR and ATR %
- volume trend and relative volume
- support / resistance baseline
- volatility regime
- structure labels

### [x] Sprint 5 — Signal Aggregation and Context Assembly

**Status**

Completed in codebase. Structured signal snapshots, deterministic scoring, persistence, and latest snapshot API read path are implemented.

**Goal**

Assemble one structured snapshot per asset.

**Rule**

This layer labels signals and assembles context. It does not decide state or suggestion.

### [x] Sprint 6 — AI Analysis Engine

**Status**

Completed in codebase. AI analysis package, OpenAI adapter, confidence clamp, daily cost cap, latest analysis persistence, worker helper, and `GET /asset-analyses/latest` are implemented.

**Goal**

Let AI perform the actual analysis from the assembled snapshot.

**Hard rules**

- AI is the analyst
- default model is `gpt-4o-mini`
- `signal_strength_score` must be calculated before the AI call
- `ai_confidence` must be validated and clamped after parsing
- every call stores `model_used`, `prompt_version`, `snapshot_hash`, `ai_latency_ms`, and `cost_estimate_usd`
- daily cap via `MAX_DAILY_AI_COST_USD`, default `2.00`

### [x] Sprint 7 — Worker Pipeline and Full Loop Validation

**Status**

Completed in codebase. The scheduled loop `fetch -> indicators -> snapshot -> AI -> persistence` is wired with context-provider status visibility and health/readiness reporting.

**Goal**

Wire fetch -> indicators -> snapshot -> AI -> persistence into a scheduled worker flow and validate usefulness before UI expansion.

### [x] Sprint 8 — Web Dashboard Basic

**Status**

Completed in codebase. The web app now exposes a read-only watchlist overview, asset detail pages, and aggregate API endpoints for seeded BTC/ETH/SOL assets.

**Goal**

Expose watchlist and asset analysis in the dashboard.

**Current delivery**

- watchlist overview ranking for seeded BTC, ETH, and SOL
- asset detail pages backed by aggregate API endpoints
- `1H` and `4H` read-timeframe support in the dashboard
- `4H` remains the scheduled operational baseline for the worker loop

### [ ] Sprint 9 — Alert Engine

**Status**

Not started yet.

**Goal**

Generate meaningful, deduplicated alerts on real state changes.

### [ ] Sprint 10 — Positions Module

**Status**

Not started yet.

**Goal**

Support manual position recording and position-aware analysis.

### [ ] Sprint 11 — Chat Layer via WhatsApp API

**Status**

Not started yet.

**Goal**

Deliver alerts and basic query access through the WhatsApp API.

**Responsibilities**

- outbound alert delivery
- inbound watchlist and asset-analysis queries
- quick position-record flows

**Rule**

The chat layer does not analyze markets. It only calls backend tools.

## Post-MVP Expansion

These items are later and must not distort the crypto MVP baseline:

- US stocks via a later adapter
- IDX stocks via Sectors.app
- additional operational timeframes beyond `4H`, including promoting `1H` from read-only support if justified
- broader context/risk layers
- approval workflows
- browser-based execution

## Development Checkpoint

Before any Sprint 4+ implementation is treated as valid, the repo should pass this checklist:

- docs consistently say crypto-first MVP
- docs consistently say WhatsApp API chat layer
- docs consistently say Binance is not used
- shared contracts include AI audit fields
- market-data runtime uses CoinGecko for crypto
- README and env examples match the actual setup
