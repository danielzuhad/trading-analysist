# AI Trading Analyst Dashboard

## 1. Product Summary

This product is a decision-support system for manual crypto trading.

It helps the user:

- monitor a crypto watchlist
- understand market conditions faster
- receive structured analysis and alerts
- track manually recorded positions
- access the same analysis through the web dashboard and the chat layer

It is not:

- an auto-trading bot
- a broker or exchange
- a high-frequency signal spammer

Trading still happens in external apps. This product owns analysis, ranking, alerting, and position-aware guidance.

## 2. Phase 1 Scope

### MVP scope

Phase 1 MVP is **crypto-first** and **private/internal first**.

Supported assets for validation:

- BTC
- ETH
- SOL

Timeframe scope for MVP:

- `4H` as the scheduled operational baseline
- `1H` and `4H` for dashboard and API read views

Phase 1 MVP includes:

- scheduled crypto market-data ingestion
- indicator computation
- signal aggregation and context assembly
- AI analysis with typed output
- watchlist ranking
- asset decision cards
- meaningful alerting
- manual position tracking
- chat delivery and query access through the WhatsApp API chat layer

Phase 1 MVP does **not** include:

- US stocks
- IDX stocks
- order execution
- broker sync
- portfolio accounting
- semi-automated trading

### Post-MVP expansion

After the crypto MVP is validated end-to-end:

- US stocks can be added via a later market-data adapter
- IDX stocks can be added via a separate provider such as Sectors.app
- additional timeframes such as `1H`, `5M`, `15M`, and `1D` can be introduced where justified

## 3. System Principles

### AI is the analyst

The AI analysis engine is the core intelligence layer.

The pipeline is:

1. fetch market data, market context, derivatives context, and sentiment
2. compute technical indicators
3. assemble a typed structured snapshot
4. calculate deterministic signal strength
5. call the AI analysis engine
6. validate, clamp, and store the output
7. detect state transitions and generate alerts

The signal aggregation layer does **not** decide state or suggestion. It assembles facts and labels only.

### Deterministic confidence anchor

Every analysis stores two separate confidence values:

- `signal_strength_score`: deterministic score calculated before the AI call
- `ai_confidence`: AI output constrained to stay within `signal_strength_score +/- 20`

Implementation rule:

1. pass `signal_strength_score` and the valid range in the prompt
2. validate `ai_confidence` after parsing
3. clamp out-of-range values without retrying
4. store both original and clamped values when they differ

### Cost and auditability

Every AI call must store:

- `model_used`
- `prompt_version`
- `snapshot_hash`
- `ai_latency_ms`
- `cost_estimate_usd`

Default model:

- `gpt-4o-mini`

Daily AI cost cap:

- env var `MAX_DAILY_AI_COST_USD`
- default `2.00`

When the cap is reached:

- skip non-critical re-analysis for `WATCH` and `IGNORE`
- continue analysis for `PREPARE`, `ACTIONABLE`, `IN_POSITION`, and `EXIT_WARNING`

### SQL-first

The data layer is SQL-first:

- Drizzle is the default database layer
- clear SQL-shaped queries are preferred
- raw SQL is allowed when simpler or more performant
- avoid unnecessary repository layers

## 4. Provider Decisions

These are the source-of-truth provider decisions for the crypto MVP:

- Crypto OHLCV, current price, and market context: **CoinGecko**
- Fear & Greed sentiment: **alternative.me**
- Crypto derivatives context: **Bybit public REST API**
- AI analysis: **OpenAI** through a provider-agnostic adapter

### Hard rule: Binance is not used

Binance is not a valid data source in this repository.

- do not use Binance for crypto OHLCV
- do not use Binance for current price
- do not keep Binance as a default fallback provider

## 5. Core Domain Output

Every analyzed asset should produce a typed result containing at least:

- `state`
- `signal_strength_score`
- `ai_confidence`
- `summary`
- `key_reasons`
- `concerns`
- `action_plan`
- `invalidation`
- `risk_level`
- `suggested_position_size`
- `timeframe_relevance`

### Asset states

- `IGNORE`
- `WATCH`
- `PREPARE`
- `ACTIONABLE`
- `IN_POSITION`
- `EXIT_WARNING`
- `INVALID`

### Suggestions for watchlist assets

- `NO_TRADE`
- `WATCH`
- `WAIT`
- `ENTRY_ON_CONFIRMATION`
- `ENTRY_SMALL`

### Suggestions for active positions

- `HOLD`
- `HOLD_TIGHT`
- `REDUCE_RISK`
- `TAKE_PARTIAL_PROFIT`
- `EXIT_IF_BREAKS_LEVEL`
- `EXIT_NOW`

## 6. Monitoring Model

The crypto MVP uses a two-path monitoring model.

### Deep analysis

- every `4H` for all watched assets

### Read-timeframe support

- dashboard and API read views support `1H` and `4H`
- `1H` is currently a read path only, not the scheduled operational baseline

### Lightweight threshold checks

- current price only
- periodic comparison against the latest support, resistance, and invalidation levels
- triggers full re-analysis when a meaningful threshold is approached

This keeps the system responsive without requiring WebSocket infrastructure in the MVP.

## 7. Chat Layer

The chat layer is a role, not a separate intelligence system.

For MVP, the chat layer uses the **WhatsApp API**.

Responsibilities:

- deliver alerts
- answer basic watchlist and asset-analysis queries
- support quick position recording flows

The chat layer does **not** perform analysis on its own. It only calls backend tools and formats delivery for chat.

Older references to `OpenClaw` in this repository mean the chat layer. New documentation should use `chat layer` or `WhatsApp API chat layer`.

## 8. Repo Shape

Phase 1 uses this monorepo baseline:

```text
apps/
  web/
  api/
  worker/

packages/
  ai-analysis/
  db/
  indicators/
  market-data/
  signal-aggregation/
  shared-types/
```

Planned additions later:

- `packages/alert-engine`
- `apps/chat-layer`

## 9. Definition of a Correct Sprint 1-3 Baseline

Before Sprint 4 work starts, the repository should already be honest about these facts:

- Sprint 1 foundation is running on Bun, Turborepo, Next.js, Fastify, BullMQ, Drizzle, PostgreSQL, and Redis
- Sprint 2 shared contracts reflect the AI-analysis audit fields and state model
- Sprint 3 market-data code fetches crypto data from CoinGecko, not Binance
- env examples and docs mention the required provider configuration
- no document implies that stocks are in current MVP scope
- no document implies that Telegram is the current MVP chat channel

## 10. MVP Success Criteria

The MVP is complete when:

- crypto watchlist assets can be analyzed on schedule
- analysis results are stored with deterministic and AI confidence fields
- dashboard can show watchlist ranking and asset detail
- meaningful alerts are generated on state changes
- manually tracked positions receive position-aware suggestions
- the WhatsApp API chat layer can deliver alerts and answer basic analysis queries

## 11. Post-MVP Direction

Post-MVP work can extend the system with:

- US stocks via a dedicated adapter selected later
- IDX stocks via Sectors.app
- `1H` and other additional timeframes if justified
- broader context and risk layers
- approval workflows
- browser-based action automation

Those are explicitly later phases. They should not distort the crypto-first MVP baseline.
