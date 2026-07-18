# Development Guide

Dokumen ini berisi setup lokal dan catatan teknis repository. README sengaja dijaga tetap high-level dan product-facing.

## Current Implementation Status

Repository ini saat ini mencakup:

- Sprint 1 foundation
- Sprint 2 shared contracts
- Sprint 3 crypto market-data baseline
- Sprint 4 indicator calculation, persistence, and read APIs
- Sprint 5 signal aggregation snapshot assembly and deterministic scoring
- Sprint 6 AI analysis engine, persistence, and read API
- Sprint 7 worker full-loop wiring, scheduled seed assets, and context-provider status visibility
- Sprint 8 read-only dashboard overview, asset detail pages, and aggregate API endpoints
- Sprint 9 alert engine, PostgreSQL alert persistence, worker state-transition alert generation, and alert read API
- Sprint 10 manual positions module, active-position API, worker position-aware analysis wiring, and basic dashboard position recording
- Sprint 11 WhatsApp API chat layer via Twilio, including inbound webhook handling and outbound alert delivery
- lightweight threshold checks that poll current price, compare against the latest key levels, and trigger full re-analysis between scheduled deep-analysis runs

## Workspace Layout

```text
apps/
  web/
  api/
  worker/

packages/
  ai-analysis/
  alert-engine/
  chat-layer/
  db/
  indicators/
  market-data/
  signal-aggregation/
  shared-types/

infrastructure/
  docker/
```

## Local Setup

1. Copy `.env.development.example` menjadi `.env.development`.
2. Isi PostgreSQL credentials dan connection URLs di `.env.development`.
3. Jalankan PostgreSQL dan Redis untuk local development.
4. Isi `COINGECKO_API_KEY` dan `COINGECKO_API_PLAN` untuk mengaktifkan market-data ingestion path saat ini.
5. Isi `OPENAI_API_KEY` jika ingin menjalankan AI analysis path secara live.
6. Gunakan Bun `1.3.11` atau lebih baru.
7. Jalankan `bun install`.
8. Jalankan monorepo dengan `bun run dev`.

Untuk menjalankan local infrastructure:

```bash
docker compose --env-file .env.development -f infrastructure/docker/docker-compose.yml up -d
```

`docker compose` tidak membaca `.env.development` secara otomatis. Tanpa `--env-file .env.development`, variabel seperti `POSTGRES_USER`, `POSTGRES_PASSWORD`, dan `POSTGRES_DB` akan dianggap kosong.

## Commands

- `bun run dev` menjalankan seluruh apps
- `bun run build` build workspace
- `bun run lint` lint seluruh packages
- `bun run typecheck` type-check seluruh packages
- `bun run test` menjalankan test suite
- `bun run db:generate` generate Drizzle migrations
- `bun run db:migrate` menjalankan Drizzle migrations

Infrastructure-backed integration tests tersedia untuk database, API routes, dan worker persistence/bootstrap flows. Jalankan dengan PostgreSQL dan Redis aktif serta `RUN_INFRA_TESTS=true`.

## Environment Notes

Credential infrastructure memang tidak di-hardcode di repository.

Untuk local development, nilai berikut harus didefinisikan di `.env.development`:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `REDIS_URL`
- `COINGECKO_API_KEY`
- `COINGECKO_API_PLAN` (`demo` untuk Demo/free key, `basic` untuk paid Basic key)
- `WORKER_ENABLE_SCHEDULER`
- `WORKER_ENABLE_THRESHOLD_CHECKS`
- `WORKER_SCHEDULED_ASSETS`
- `WORKER_SCHEDULED_TIMEFRAMES`
- `WORKER_THRESHOLD_CHECK_INTERVAL_MINUTES`

Nilai berikut dibutuhkan saat AI analysis live ingin dijalankan:

- `OPENAI_API_KEY`

Nilai berikut dibutuhkan saat WhatsApp API chat layer ingin dijalankan secara live:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_WHATSAPP_TO`
- `TWILIO_WEBHOOK_URL`

Nilai berikut opsional untuk delivery callback:

- `TWILIO_STATUS_CALLBACK_URL` jika ingin mengarahkan status callback ke endpoint publik terpisah di luar route repo saat ini

CoinGecko auth dipilih lewat `COINGECKO_API_PLAN`. Nilai `demo` memakai host publik `api.coingecko.com` dengan header `x-cg-demo-api-key`. Nilai `basic` memakai host paid `pro-api.coingecko.com` dengan header `x-cg-pro-api-key`.
Pada `demo`, worker memakai `market_chart` 90 hari tanpa parameter `interval`, lalu membentuk candle 1H/4H internal agar indikator EMA200 tetap punya histori yang cukup. Paid Basic tetap memakai OHLC hourly dari Pro API.

Context providers gratis lain yang dipakai saat ini tidak membutuhkan env tambahan.

Tooling database seperti `bun run db:migrate` membaca env dari workspace root dengan urutan `.env`, `.env.development` atau `.env.production`, lalu `.env.local`.

Web, API, dan worker startup juga membaca env dari workspace root dengan precedence yang sama agar `bun run dev` konsisten saat dijalankan dari root repo.

Production values seharusnya diletakkan di `.env.production` atau secret store pada environment deployment.

## Current Read Endpoints

Endpoint read yang tersedia saat ini:

- `GET /market-snapshots/latest?assetId=...&timeframe=...`
- `GET /indicator-snapshots/latest?assetId=...&timeframe=...`
- `GET /signal-snapshots/latest?assetId=...&timeframe=...`
- `GET /asset-analyses/latest?assetId=...&timeframe=...`
- `GET /watchlist/overview?timeframe=...`
- `GET /assets/:assetId/overview?timeframe=...`
- `GET /alerts?assetId=...&timeframe=...&status=...&limit=...`
- `GET /positions?assetId=...&status=...&activeOnly=...&limit=...`
- `GET /positions/active?assetId=...`
- `POST /positions`
- `PATCH /positions/:positionId`
- `POST /positions/:positionId/close`
- `GET /readyz`

Endpoint chat layer yang tersedia saat ini:

- `POST /chat-layer/twilio/webhook`

`GET /health` dan `GET /readyz` juga membawa status operasional untuk context providers, AI daily cost cap, dan kegagalan AI seperti quota/billing OpenAI.

## Provider Notes

Current external-provider implementation status through Sprint 7:

- CoinGecko: implemented untuk crypto OHLCV, latest-price ingestion, dan macro market context
- alternative.me Fear & Greed: wired untuk market sentiment context
- Bybit: wired untuk funding rate dan open interest context
- OpenAI: wired untuk AI analysis engine melalui provider adapter dan `OPENAI_API_KEY`
- WhatsApp API chat layer: implemented via Twilio for outbound alerts and inbound chat commands

Alert generation sekarang membuat channel `dashboard` dan `whatsapp`.
Worker akan mencoba delivery WhatsApp melalui Twilio saat env chat layer tersedia.

MVP saat ini diasumsikan private/internal dulu, dengan scope operasional utama `4H` untuk BTC, ETH, dan SOL.

Dashboard dan API read path saat ini mendukung `1H` dan `4H`.
`1H` belum menjadi scheduled operational baseline untuk worker loop.

Worker sekarang juga punya lightweight threshold checks yang:

- poll current price via CoinGecko
- compare price against latest support, resistance, and invalidation levels
- trigger full re-analysis when price is within the ATR-based threshold window

Default threshold poll interval saat ini adalah `15` menit.
Cooldown re-analysis internal saat ini adalah `15` menit untuk `1H` dan `60` menit untuk `4H`.

Binance tidak dipakai di repository ini.

Kalau satu context provider gagal, worker tetap lanjut dengan `partial context`. Status provider tersebut terlihat di API health/readiness dan web status card.

## Hooks and Tooling

Husky aktif di repository ini.

- `pre-commit` menjalankan `bun run lint`, `bun run typecheck`, dan `bun run test`

Root validation scripts (`build`, `lint`, `typecheck`, dan `test`) berjalan melalui `scripts/run-turbo.mjs` agar kompatibel dengan PowerShell dan WSL.
Wrapper ini memilih Turbo cache directory dari `TURBO_CACHE_DIR`, atau memakai temp directory OS bila env tersebut kosong.
Untuk WSL/Linux, `bun run test` tetap memaksa `TMPDIR`, `TEMP`, dan `TMP` ke `/tmp` bila belum didefinisikan.
Ini menghindari Vitest/Bun memakai temp directory Windows saat repository dijalankan dari WSL.

CI workflow menyalakan PostgreSQL dan Redis services, menjalankan `bun run db:migrate`, lalu menjalankan test suite dengan `RUN_INFRA_TESTS=true`.

## Local Infra Notes

Docker diharapkan tersedia untuk PostgreSQL dan Redis lokal. Di WSL, Docker Desktop WSL integration harus aktif sebelum `docker compose` bisa dipakai.

Kalau `bun` masih resolve ke instalasi Windows saat bekerja di WSL, prioritaskan binary Bun native WSL pada `PATH`.
