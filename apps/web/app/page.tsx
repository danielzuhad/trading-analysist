import Link from "next/link";

import {
  fetchAlerts,
  fetchWatchlist,
  fetchWatchlistOverview,
  resolveDashboardTimeframe,
} from "../dashboard";
import { loadWebEnv } from "../env";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
} from "../status";
import { AlertFeed } from "./alert-feed";
import { CoinLogo } from "./coin-logo";
import { formatPrice, readAssetImageUrl } from "./dashboard-format";
import {
  DashboardTimeframeTabs,
  DeltaText,
  MissingDataList,
  ScoreBar,
  StateBadge,
} from "./dashboard-primitives";
import { InfrastructureStatusCard } from "./infrastructure-status-card";
import { OperationalWarningBanner } from "./operational-warning-banner";
import { WatchlistCardActions } from "./watchlist-card-actions";
import { WatchlistSearch } from "./watchlist-search";

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
  const [overviewResult, watchlistResult, infrastructureStatus, alertsResult] =
    await Promise.all([
      fetchWatchlistOverview(apiBaseUrl, timeframe),
      fetchWatchlist(apiBaseUrl),
      fetchInfrastructureStatus(apiBaseUrl),
      fetchAlerts(apiBaseUrl, {
        limit: 6,
        timeframe,
      }),
    ]);
  const items = overviewResult.data?.items ?? [];
  const alerts = alertsResult.data?.alerts ?? [];
  const watchlistEntries = watchlistResult.data?.entries ?? [];
  const watchlistLimit = watchlistResult.data?.limit ?? null;
  const watchlistEntryByAssetId = new Map(
    watchlistEntries.map((entry) => [entry.asset.id, entry]),
  );
  const analyzedAssetIds = new Set(items.map((item) => item.asset.id));
  const pendingEntries = watchlistEntries.filter(
    (entry) => !analyzedAssetIds.has(entry.asset.id),
  );
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
          {watchlistLimit ? (
            <span
              className="inline-chip"
              title={`The watchlist is capped at ${watchlistLimit} assets to keep AI analysis cost and market-data rate limits under control.`}
            >
              {watchlistEntries.length}/{watchlistLimit} slots
            </span>
          ) : null}
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

      <WatchlistSearch
        watchlistCount={watchlistEntries.length}
        watchlistLimit={watchlistLimit}
      />

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
              {items.map((item) => {
                const watchlistEntry = watchlistEntryByAssetId.get(
                  item.asset.id,
                );

                return (
                  <Link
                    key={`${item.asset.id}:${item.timeframe}`}
                    className="asset-card"
                    href={`/assets/${item.asset.symbol.toLowerCase()}?timeframe=${timeframe}`}
                  >
                    <div className="asset-card__header">
                      <div className="asset-card__identity">
                        <CoinLogo
                          imageUrl={readAssetImageUrl(item.asset.metadata)}
                          size={34}
                          symbol={item.asset.symbol}
                        />
                        <div>
                          <p className="asset-card__symbol">
                            {item.asset.symbol}
                          </p>
                          <p className="asset-card__name">{item.asset.name}</p>
                        </div>
                      </div>
                      <div className="asset-card__meta">
                        <StateBadge state={item.state} />
                        {watchlistEntry ? (
                          <WatchlistCardActions
                            aiEnabled={watchlistEntry.aiEnabled}
                            assetId={item.asset.id}
                            symbol={item.asset.symbol}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="asset-card__price">
                      <strong>{formatPrice(item.lastPrice)}</strong>
                      <DeltaText value={item.priceChangePercent} />
                    </div>

                    <div className="score-row">
                      <ScoreBar
                        label="Signal"
                        value={item.signalStrengthScore}
                      />
                      <ScoreBar
                        label="AI confidence"
                        value={item.aiConfidence}
                      />
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
                );
              })}
            </div>
          )}

          {pendingEntries.length > 0 ? (
            <article className="card pending-assets">
              <h3>Waiting for first analysis</h3>
              <ul className="pending-assets__list">
                {pendingEntries.map((entry) => (
                  <li key={entry.asset.id}>
                    <span className="pending-assets__coin">
                      <CoinLogo
                        imageUrl={readAssetImageUrl(entry.asset.metadata)}
                        size={22}
                        symbol={entry.asset.symbol}
                      />
                      <strong>{entry.asset.symbol}</strong>
                      <span>{entry.asset.name}</span>
                    </span>
                    <WatchlistCardActions
                      aiEnabled={entry.aiEnabled}
                      assetId={entry.asset.id}
                      symbol={entry.asset.symbol}
                    />
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
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
