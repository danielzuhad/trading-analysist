# AI Trading Analyst Dashboard — Sprint Roadmap

## Overview

This roadmap follows two main phases:

- **Phase 1 — Core Analyst MVP & Intelligence Expansion**
- **Phase 2 — Approval & Action Layer**

The recommended build order is:

1. Foundation
2. Core Analyst Engine
3. Internal API + Validation
4. Web Dashboard
5. Positions Module
6. Alert Engine
7. AI Interpretation Layer
8. OpenClaw Integration
9. Context / Risk Expansion
10. Hardening
11. Approval & Action Layer

---

# Phase 1 — Core Analyst MVP & Intelligence Expansion

## Sprint 1 — Foundation Setup

**Goal:**  
Set up the project foundation so development can run smoothly.

**Locked stack for Sprint 1:**

- `bun` for package management, workspaces, and scripts
- `turborepo` for monorepo orchestration
- `fastify` for the API
- `drizzle` for the SQL-first database layer
- `bullmq` for jobs / scheduling
- `docker compose` for local PostgreSQL + Redis

**Tasks:**

- Initialize monorepo with Bun workspaces
- Add Turborepo
- Create:
  - `apps/web`
  - `apps/api`
  - `apps/worker`
  - shared packages
- Create a dedicated database package for Drizzle schema, migrations, and SQL helpers
- Set up TypeScript
- Set up linting, formatting, and testing
- Set up PostgreSQL and Redis with Docker Compose
- Set up environment variable management
- Set up basic CI
- Establish Fastify app bootstrap
- Establish Drizzle database bootstrap
- Establish BullMQ worker bootstrap

**Output:**

- Repo is ready
- Web, API, and worker can run
- Database and Redis are connected
- Core toolchain decisions are documented in the repo

---

## Sprint 2 — Domain Models and Core Contracts

**Goal:**  
Define the internal data contracts and decision structure.

**Tasks:**

- Define:
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
- Define decision states:
  - `IGNORE`
  - `WATCH`
  - `PREPARE`
  - `ACTIONABLE`
  - `IN_POSITION`
  - `EXIT_WARNING`
  - `INVALID`
- Define decision card contract:
  - `summary`
  - `keyReasons`
  - `actionPlan`
  - `executionMethod`
  - `invalidation`
  - `riskLevel`

**Output:**

- Core types are stable
- Decision card structure is defined

---

## Sprint 3 — Market Data Ingestion

**Goal:**  
Fetch crypto and stock market data reliably.

**Tasks:**

- Build Binance adapter for crypto
- Build Twelve Data adapter for stocks
- Normalize both into one internal schema
- Support initial timeframes:
  - `1H`
  - `4H`
- Create reusable market fetch service

**Output:**

- System can fetch price and OHLCV data
- Normalized market snapshots are available

---

## Sprint 4 — Indicator Engine

**Goal:**  
Compute objective technical signals before AI is involved.

**Tasks:**

- Implement EMA 20 / 50 / 200
- Implement RSI
- Implement ATR
- Implement volume trend
- Implement support/resistance baseline
- Implement volatility baseline
- Add tests for calculations

**Output:**

- Each asset has an indicator snapshot

---

## Sprint 5 — Rules Engine and State Engine

**Goal:**  
Convert technical signals into structured baseline decisions.

**Tasks:**

- Implement regime detection
- Implement bias determination
- Implement setup quality scoring
- Implement risk flags
- Implement asset state derivation
- Add transition rules to avoid noisy flipping

**Output:**

- The system can assign states like:
  - `WATCH`
  - `PREPARE`
  - `ACTIONABLE`
- Analysis works without AI freestyle output

---

## Sprint 6 — Worker Pipeline and Persistence

**Goal:**  
Run analysis automatically and store results.

**Tasks:**

- Create scheduled analysis jobs
- Build analysis pipeline:
  1. Fetch market data
  2. Compute indicators
  3. Apply rules
  4. Derive state
  5. Save analysis
  6. Save state transitions
- Persist data into PostgreSQL

**Output:**

- Scheduled analysis works
- Analysis history and transitions are stored

---

## Sprint 7 — Internal API and CLI Validation

**Goal:**  
Validate usefulness before building the full dashboard.

**Tasks:**

- Build API endpoints for:
  - watchlist overview
  - asset detail
  - alerts
- Build simple CLI or JSON output
- Validate:
  - ranking usefulness
  - state quality
  - summary usefulness

**Output:**

- Core analysis can be tested without the full UI
- Product usefulness is validated early

---

## Sprint 8 — Web Dashboard Basic

**Goal:**  
Expose the analyst engine through a usable dashboard.

**Tasks:**

- Build watchlist overview page
- Build asset decision card page
- Build alert feed page
- Build basic settings page

**Output:**

- Users can scan the watchlist
- Users can open decision cards for each asset

---

## Sprint 9 — Positions Module

**Goal:**  
Support manual position logging and monitoring.

**Tasks:**

- Build positions list page
- Build record position page
- Build position detail page
- Support:
  - new position record
  - add to position
  - close position
  - update stop loss / take profit
  - update notes
- Change logic from watchlist mode to position monitoring mode

**Output:**

- Manual positions can be tracked
- Active positions receive position-aware suggestions

---

## Sprint 10 — Alert Engine

**Goal:**  
Make the system proactive without becoming spammy.

**Tasks:**

- Generate alerts for meaningful state changes
- Save alert history
- Add cooldown / dedup logic
- Add severity / priority

**Output:**

- Alert feed becomes useful
- Notifications are meaningful instead of noisy

---

## Sprint 11 — AI Interpretation Layer

**Goal:**  
Use AI to turn structured analysis into human-friendly decision plans.

**Tasks:**

- Build prompt builder from structured snapshots
- Validate AI output schema
- Generate:
  - summary
  - key reasons
  - action plan
  - invalidation
  - risk wording
- Add deterministic fallback if AI fails

**Output:**

- Decision cards become more readable
- AI improves explanation quality without replacing core logic

---

## Sprint 12 — OpenClaw Integration

**Goal:**  
Add chat access and notification delivery.

**Tasks:**

- Expose backend tools:
  - `get_watchlist_overview`
  - `get_asset_decision_card`
  - `get_top_actionable_assets`
  - `get_recent_alerts`
  - `get_position_overview`
- Connect OpenClaw to backend APIs
- Set up WhatsApp / chat delivery
- Support simple question flows

**Output:**

- Users can access watchlist intelligence through chat
- Alerts can be delivered through the agent layer

---

# Phase 1 Expansion

## Sprint 13 — Context Layer v1

**Goal:**  
Move beyond technical-only analysis.

**Tasks:**

- Add event calendar basics
- Add major news risk flags
- Add basic macro context
- Enrich decision snapshots with context fields

**Output:**

- The system becomes more than a chart reader
- Decisions start using multi-factor inputs

---

## Sprint 14 — High-Value Context by Asset Class

**Goal:**  
Add the most valuable non-technical factors.

**Stocks:**

- earnings calendar
- company news
- sector-relative strength
- simple fundamentals snapshot

**Crypto:**

- funding rate
- open interest
- token unlock calendar
- market-wide crypto regime context

**Output:**

- Asset analysis becomes more precise

---

## Sprint 15 — Risk Scoring and Conflict Detection

**Goal:**  
Improve decision precision and reduce bad decisions.

**Tasks:**

- Add event risk scoring
- Add volatility risk scoring
- Add contradiction / conflict detection
- Improve confidence scoring
- Improve asset ranking logic

**Output:**

- The system can explain not only what looks good, but also what is risky or conflicting

---

## Sprint 16 — Hardening

**Goal:**  
Stabilize the platform before action workflows.

**Tasks:**

- Add observability
- Add structured logs
- Add job metrics
- Add retries
- Add audit trail
- Add fallback handling
- Strengthen tests

**Output:**

- The analyst platform is more stable and production-ready

---

# Phase 2 — Approval & Action Layer

## Sprint 17 — Approval Flow

**Goal:**  
Introduce user confirmation before action execution.

**Tasks:**

- Build approval state machine
- Implement ask-confirm-act flow
- Add approval / reject / cancel flow
- Store approval history

**Output:**

- Action requests can be confirmed before execution

---

## Sprint 18 — Browser Action Abstraction

**Goal:**  
Define a structured action layer before browser automation.

**Tasks:**

- Define action contracts for:
  - open asset page
  - prepare buy/sell draft
  - update stop loss / take profit
  - close / reduce position
  - cancel pending order
- Define execution records
- Define venue capability profiles

**Output:**

- Execution logic is structured before automation starts

---

## Sprint 19 — Stockbit Browser Workflow

**Goal:**  
Implement browser-based workflow for Stockbit Web.

**Tasks:**

- Automate Stockbit Web flow
- Add verification after click/type
- Add retry and failure handling
- Log execution results

**Output:**

- Stockbit browser-based workflow works for supported cases

---

## Sprint 20 — Tokocrypto Browser Workflow

**Goal:**  
Implement browser-based workflow for Tokocrypto Spot Web.

**Tasks:**

- Automate Tokocrypto Spot Web flow
- Support order preparation and cancellation
- Sync action results back into the system

**Output:**

- Tokocrypto browser-based workflow works for supported cases

---

## Sprint 21 — Audit, Safeguards, and Failure Handling

**Goal:**  
Finalize safety and reliability for the action layer.

**Tasks:**

- Add explicit approval checks
- Classify failures:
  - login issues
  - selector changes
  - captcha / 2FA
  - popup interference
- Complete audit trail
- Finalize human-in-the-loop safeguards

**Output:**

- The action layer becomes safer and easier to trust/debug

---

# MVP Definition

The MVP is complete when:

- users can maintain a crypto + stock watchlist
- backend can analyze watched assets on a schedule
- dashboard shows watchlist ranking and asset decision cards
- users can manually log active positions
- the system changes suggestion style for in-position assets
- alerts are generated on meaningful state change
- AI improves summary and explanation quality
- OpenClaw can answer watchlist and alert questions through chat

---

# Full Development Completion

Development is considered complete for this roadmap when:

- MVP criteria are complete
- context/risk expansion is added
- approval flow is implemented
- browser-based action works for:
  - Stockbit Web
  - Tokocrypto Spot Web
- audit trail and safeguards are complete

---

# Simple Sprint Summary

- **Sprints 1–6** → Foundation + Core Analyst Engine
- **Sprints 7–12** → API + Dashboard + Positions + Alerts + AI + OpenClaw
- **Sprints 13–16** → Context / Risk Expansion + Hardening
- **Sprints 17–21** → Approval + Browser-Based Action Layer
