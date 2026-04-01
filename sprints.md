# AI Trading Analyst Dashboard — Sprint Roadmap

## Roadmap Rule

Development must follow the sprint order unless the user explicitly reprioritizes.

Current alignment target for this repository:

- keep the codebase honest through **Sprint 3**
- do not start Sprint 4+ implementation on top of mismatched Sprint 1-3 foundations

## Phase 1 — Crypto MVP

### Sprint 1 — Foundation Setup

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

### Sprint 2 — Domain Models and Core Contracts

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

### Sprint 3 — Market Data Ingestion

**Goal**

Fetch crypto market data and normalize it into one internal schema.

**MVP scope**

- crypto only
- `1H` and `4H` only

**Provider decisions**

- crypto OHLCV and current price: Twelve Data
- market context: CoinGecko
- sentiment: alternative.me Fear & Greed Index
- derivatives: Bybit public REST API
- crypto news: CryptoPanic

**Hard rules**

- Binance is out of scope and must not be used
- stock ingestion is post-MVP
- do not implement `5M`, `15M`, or `1D` in the MVP ingestion path

**Output**

- normalized crypto candle series and latest market snapshot
- env and runtime wiring for Twelve Data
- provider selection aligned with the crypto-first MVP

## Phase 1 — Next Sprints After Alignment

These sprints are the next steps after Sprint 1-3 are aligned.

### Sprint 4 — Indicator Engine

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

### Sprint 5 — Signal Aggregation and Context Assembly

**Goal**

Assemble one structured snapshot per asset.

**Rule**

This layer labels signals and assembles context. It does not decide state or suggestion.

### Sprint 6 — AI Analysis Engine

**Goal**

Let AI perform the actual analysis from the assembled snapshot.

**Hard rules**

- AI is the analyst
- default model is `gpt-4o-mini`
- `signal_strength_score` must be calculated before the AI call
- `ai_confidence` must be validated and clamped after parsing
- every call stores `model_used`, `prompt_version`, `snapshot_hash`, `ai_latency_ms`, and `cost_estimate_usd`
- daily cap via `MAX_DAILY_AI_COST_USD`, default `2.00`

### Sprint 7 — Worker Pipeline and Full Loop Validation

**Goal**

Wire fetch -> indicators -> snapshot -> AI -> persistence into a scheduled worker flow and validate usefulness before UI expansion.

### Sprint 8 — Web Dashboard Basic

**Goal**

Expose watchlist and asset analysis in the dashboard.

### Sprint 9 — Alert Engine

**Goal**

Generate meaningful, deduplicated alerts on real state changes.

### Sprint 10 — Positions Module

**Goal**

Support manual position recording and position-aware analysis.

### Sprint 11 — Chat Layer via WhatsApp API

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

- US stocks via Twelve Data
- IDX stocks via Sectors.app
- additional timeframes beyond `1H` and `4H`
- broader context/risk layers
- approval workflows
- browser-based execution

## Development Checkpoint

Before any Sprint 4+ implementation is treated as valid, the repo should pass this checklist:

- docs consistently say crypto-first MVP
- docs consistently say WhatsApp API chat layer
- docs consistently say Binance is not used
- shared contracts include AI audit fields
- market-data runtime uses Twelve Data for crypto
- README and env examples match the actual setup
