import Link from "next/link";

import {
  fetchWatchlistOverview,
  resolveDashboardTimeframe,
} from "../dashboard";
import { loadWebEnv } from "../env";
import { fetchInfrastructureStatus } from "../status";
import { formatPercent, formatPrice, formatScore } from "./dashboard-format";
import {
  DashboardTimeframeTabs,
  MissingDataList,
  OverviewStatusBadge,
  StateBadge,
} from "./dashboard-primitives";
import { InfrastructureStatusCard } from "./infrastructure-status-card";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{
    timeframe?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const timeframe = resolveDashboardTimeframe(resolvedSearchParams?.timeframe);
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const [overviewResult, infrastructureStatus] = await Promise.all([
    fetchWatchlistOverview(apiBaseUrl, timeframe),
    fetchInfrastructureStatus(apiBaseUrl),
  ]);
  const items = overviewResult.data?.items ?? [];
  const counts = items.reduce(
    (summary, item) => {
      summary[item.status] += 1;
      return summary;
    },
    {
      partial: 0,
      pending: 0,
      ready: 0,
    },
  );
  const leadItem = items[0];

  return (
    <main className="shell shell--dashboard">
      <section className="hero hero--dashboard">
        <div className="hero-copy">
          <p className="eyebrow">Sprint 8 Dashboard</p>
          <h1>Crypto Watchlist Overview</h1>
          <p className="lede">
            Read-only ranking for the seeded BTC, ETH, and SOL MVP universe. The
            dashboard now supports both 1H and 4H read views while 4H remains
            the operational baseline for the worker loop.
          </p>
        </div>

        <div className="hero-actions">
          <DashboardTimeframeTabs basePath="/" timeframe={timeframe} />
          <div className="hero-metrics">
            <article className="hero-metric-card">
              <span className="hero-metric-label">Primary loop</span>
              <strong>4H</strong>
              <p>Worker schedule and AI baseline stay anchored here.</p>
            </article>
            <article className="hero-metric-card">
              <span className="hero-metric-label">Top ranked asset</span>
              <strong>{leadItem?.asset.symbol ?? "Unavailable"}</strong>
              <p>
                {leadItem?.summary ??
                  "No ranked asset is available until snapshots are stored."}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card card--summary">
          <div className="card-heading">
            <h2>Loop Snapshot</h2>
            <OverviewStatusBadge
              status={
                overviewResult.status === "ready"
                  ? "ready"
                  : items.length > 0
                    ? "partial"
                    : "pending"
              }
            />
          </div>
          <p>{overviewResult.message}</p>
          <div className="metric-grid">
            <div className="metric">
              <span>Ready</span>
              <strong>{counts.ready}</strong>
            </div>
            <div className="metric">
              <span>Partial</span>
              <strong>{counts.partial}</strong>
            </div>
            <div className="metric">
              <span>Pending</span>
              <strong>{counts.pending}</strong>
            </div>
          </div>
          {overviewResult.issues.map((issue) => (
            <p key={issue} className="issue-text">
              {issue}
            </p>
          ))}
        </article>

        <article className="card card--summary">
          <div className="card-heading">
            <h2>API Reachability</h2>
            <OverviewStatusBadge
              status={
                infrastructureStatus.status === "ready"
                  ? "ready"
                  : infrastructureStatus.status === "degraded"
                    ? "partial"
                    : "pending"
              }
            />
          </div>
          <p>{infrastructureStatus.message}</p>
          <p>
            API base URL: {apiBaseUrl ?? "Set NEXT_PUBLIC_API_BASE_URL first"}
          </p>
          <p>Dashboard timeframe: {timeframe}</p>
        </article>

        <InfrastructureStatusCard apiBaseUrl={apiBaseUrl} />
      </section>

      <section className="watchlist-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Watchlist</p>
            <h2>Ranked Assets</h2>
          </div>
          <p className="section-copy">
            Each card merges the latest market, signal, and AI read model for
            the selected timeframe.
          </p>
        </div>

        {items.length === 0 ? (
          <article className="card">
            <h3>No watchlist data yet</h3>
            <p>
              Run the worker loop first so the API can serve market snapshots,
              signal snapshots, and the latest analysis records.
            </p>
          </article>
        ) : (
          <div className="asset-grid">
            {items.map((item) => (
              <Link
                key={`${item.asset.id}:${item.timeframe}`}
                className="asset-card"
                href={`/assets/${item.asset.symbol.toLowerCase()}?timeframe=${timeframe}`}
              >
                <div className="asset-card__header">
                  <div>
                    <p className="asset-card__symbol">{item.asset.symbol}</p>
                    <p className="asset-card__name">{item.asset.name}</p>
                  </div>
                  <OverviewStatusBadge status={item.status} />
                </div>

                <div className="asset-card__meta">
                  <StateBadge state={item.state} />
                  <span className="inline-chip">{item.timeframe}</span>
                </div>

                <div className="asset-card__price">
                  <strong>{formatPrice(item.lastPrice)}</strong>
                  <span>{formatPercent(item.priceChangePercent)}</span>
                </div>

                <div className="asset-card__scores">
                  <div>
                    <span>Signal</span>
                    <strong>{formatScore(item.signalStrengthScore)}</strong>
                  </div>
                  <div>
                    <span>AI confidence</span>
                    <strong>{formatScore(item.aiConfidence)}</strong>
                  </div>
                </div>

                <p className="asset-card__summary">
                  {item.summary ?? "Awaiting analysis output for this asset."}
                </p>

                <div className="asset-card__levels">
                  <span>Support {formatPrice(item.nearestSupport)}</span>
                  <span>Resistance {formatPrice(item.nearestResistance)}</span>
                  <span>Invalidation {formatPrice(item.invalidation)}</span>
                </div>

                {item.keyReasons.length > 0 ? (
                  <ul className="asset-card__list">
                    {item.keyReasons.slice(0, 2).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}

                <MissingDataList items={item.missingData} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
