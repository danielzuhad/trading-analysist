# Development Guide

Dokumen ini berisi setup lokal dan catatan teknis repository. README sengaja dijaga tetap high-level dan product-facing.

## Current Implementation Status

Repository ini saat ini mencakup:

- Sprint 1 foundation
- Sprint 2 shared contracts
- Sprint 3 crypto market-data baseline
- Sprint 4 indicator calculation, persistence, and read APIs
- Sprint 5 signal aggregation snapshot assembly and deterministic scoring

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
  signal-aggregation/
  shared-types/

infrastructure/
  docker/
```

## Local Setup

1. Copy `.env.development.example` menjadi `.env.development`.
2. Isi PostgreSQL credentials dan connection URLs di `.env.development`.
3. Jalankan PostgreSQL dan Redis untuk local development.
4. Isi `TWELVE_DATA_API_KEY` untuk mengaktifkan market-data ingestion path saat ini.
5. Gunakan Bun `1.3.11` atau lebih baru.
6. Jalankan `bun install`.
7. Jalankan monorepo dengan `bun run dev`.

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

Tooling database seperti `bun run db:migrate` membaca env dari workspace root dengan urutan `.env`, `.env.development` atau `.env.production`, lalu `.env.local`.

Web, API, dan worker startup juga membaca env dari workspace root dengan precedence yang sama agar `bun run dev` konsisten saat dijalankan dari root repo.

Production values seharusnya diletakkan di `.env.production` atau secret store pada environment deployment.

## Current Read Endpoints

Endpoint read yang tersedia saat ini:

- `GET /market-snapshots/latest?assetId=...&timeframe=...`
- `GET /indicator-snapshots/latest?assetId=...&timeframe=...`
- `GET /signal-snapshots/latest?assetId=...&timeframe=...`
- `GET /readyz`

## Provider Notes

Current external-provider implementation status through Sprint 4:

- Twelve Data: implemented untuk crypto OHLCV dan latest-price ingestion
- CoinGecko, alternative.me, Bybit, dan CryptoPanic: approved untuk MVP, belum wired di codebase saat ini
- OpenAI: approved AI provider, belum wired di codebase saat ini
- WhatsApp API chat layer: target delivery channel, belum implemented di codebase saat ini

Twelve Data tetap menjadi provider utama untuk crypto MVP.

Binance tidak dipakai di repository ini.

## Hooks and Tooling

Husky aktif di repository ini.

- `pre-commit` menjalankan `bun run lint`, `bun run typecheck`, dan `bun run test`

CI workflow menyalakan PostgreSQL dan Redis services, menjalankan `bun run db:migrate`, lalu menjalankan test suite dengan `RUN_INFRA_TESTS=true`.

## Local Infra Notes

Docker diharapkan tersedia untuk PostgreSQL dan Redis lokal. Di WSL, Docker Desktop WSL integration harus aktif sebelum `docker compose` bisa dipakai.

Kalau `bun` masih resolve ke instalasi Windows saat bekerja di WSL, prioritaskan binary Bun native WSL pada `PATH`.
