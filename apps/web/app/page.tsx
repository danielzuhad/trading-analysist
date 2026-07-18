import Link from "next/link";

import {
  fetchAlerts,
  fetchWatchlistOverview,
  resolveDashboardTimeframe,
} from "../dashboard";
import { loadWebEnv } from "../env";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
} from "../status";
import { AlertFeed } from "./alert-feed";
import { formatPrice } from "./dashboard-format";
import {
  DashboardTimeframeTabs,
  DeltaText,
  MissingDataList,
  ScoreBar,
  StateBadge,
} from "./dashboard-primitives";
import { InfrastructureStatusCard } from "./infrastructure-status-card";
import { OperationalWarningBanner } from "./operational-warning-banner";

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
  const [overviewResult, infrastructureStatus, alertsResult] =
    await Promise.all([
      fetchWatchlistOverview(apiBaseUrl, timeframe),
      fetchInfrastructureStatus(apiBaseUrl),
      fetchAlerts(apiBaseUrl, {
        limit: 6,
        timeframe,
      }),
    ]);
  const items = overviewResult.data?.items ?? [];
  const alerts = alertsResult.data?.alerts ?? [];
  const aiWarning = buildAiOperationalWarning(infrastructureStatus);
  const systemTone =
    infrastructureStatus.status === "ready"
      ? "ok"
      : infrastructureStatus.status === "degraded"
        ? "warn"
        : "down";

  return (
    <main className="shell">
      <div className="page-heading">
        <h1>Watchlist</h1>
        <div className="page-heading__meta">
          <span className="inline-chip">
            <span className={`status-dot status-dot--${systemTone}`} />
            {systemTone === "ok"
              ? "All systems running"
              : systemTone === "warn"
                ? "System degraded"
                : "System issue"}
          </span>
          <DashboardTimeframeTabs basePath="/" timeframe={timeframe} />
        </div>
      </div>

      {aiWarning ? <OperationalWarningBanner warning={aiWarning} /> : null}

      <div className="dashboard-columns">
        <section aria-label="Ranked assets">
          {items.length === 0 ? (
            <article className="card">
              <h3>No data yet</h3>
              <p>
                The analysis worker hasn't stored any snapshots for this
                timeframe. Data appears here after the first analysis cycle
                completes.
              </p>
              {overviewResult.issues.map((issue) => (
                <p key={issue} className="issue-text">
                  {issue}
                </p>
              ))}
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
                    <StateBadge state={item.state} />
                  </div>

                  <div className="asset-card__price">
                    <strong>{formatPrice(item.lastPrice)}</strong>
                    <DeltaText value={item.priceChangePercent} />
                  </div>

                  <div className="score-row">
                    <ScoreBar label="Signal" value={item.signalStrengthScore} />
                    <ScoreBar label="AI confidence" value={item.aiConfidence} />
                  </div>

                  <p className="asset-card__summary">
                    {item.summary ?? "Waiting for the first analysis."}
                  </p>

                  <div className="asset-card__levels">
                    <span className="level-text level-text--support">
                      S <strong>{formatPrice(item.nearestSupport)}</strong>
                    </span>
                    <span className="level-text level-text--resistance">
                      R <strong>{formatPrice(item.nearestResistance)}</strong>
                    </span>
                    <span className="level-text level-text--invalidation">
                      Inv <strong>{formatPrice(item.invalidation)}</strong>
                    </span>
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

        <section aria-label="Alerts and system status">
          <AlertFeed
            alerts={alerts}
            emptyMessage="No alerts for this timeframe yet. Alerts appear when an asset changes state."
            issues={alertsResult.issues}
            message={alertsResult.message}
            title="Recent Alerts"
          />
          <InfrastructureStatusCard apiBaseUrl={apiBaseUrl} />
        </section>
      </div>
    </main>
  );
}
