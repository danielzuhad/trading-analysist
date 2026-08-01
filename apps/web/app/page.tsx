import Link from "next/link";

import { AlertFeed } from "@/components/dashboard/alert-feed";
import { CoinLogo } from "@/components/dashboard/coin-logo";
import {
  DashboardTimeframeTabs,
  DeltaText,
  InfoPill,
  MissingDataList,
  ScoreBar,
  StateBadge,
} from "@/components/dashboard/dashboard-primitives";
import { OperationalWarningBanner } from "@/components/dashboard/operational-warning-banner";
import { PortfolioOverviewCard } from "@/components/dashboard/portfolio-overview-card";
import { SystemStatusButton } from "@/components/dashboard/system-status-button";
import { WatchlistCardActions } from "@/components/dashboard/watchlist-card-actions";
import { WatchlistSearch } from "@/components/dashboard/watchlist-search";
import {
  fetchAlerts,
  fetchPortfolioOverview,
  fetchWatchlist,
  fetchWatchlistOverview,
  resolveDashboardTimeframe,
} from "@/lib/dashboard";
import { formatPrice, readAssetImageUrl } from "@/lib/dashboard-format";
import { loadWebEnv } from "@/lib/env";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
} from "@/lib/status";

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
  const [
    overviewResult,
    watchlistResult,
    infrastructureStatus,
    alertsResult,
    portfolioResult,
  ] = await Promise.all([
    fetchWatchlistOverview(apiBaseUrl, timeframe),
    fetchWatchlist(apiBaseUrl),
    fetchInfrastructureStatus(apiBaseUrl),
    fetchAlerts(apiBaseUrl, {
      limit: 6,
      timeframe,
    }),
    fetchPortfolioOverview(apiBaseUrl),
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

  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3.5 sm:flex-col sm:items-stretch">
        <h1 className="m-0 text-[1.35rem] tracking-[-0.01em]">Watchlist</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          {watchlistLimit ? (
            <InfoPill
              title={`The watchlist is capped at ${watchlistLimit} assets to keep AI analysis cost and market-data rate limits under control.`}
            >
              {watchlistEntries.length}/{watchlistLimit} slots
            </InfoPill>
          ) : null}
          <SystemStatusButton
            apiBaseUrl={apiBaseUrl}
            initialStatus={infrastructureStatus}
          />
          <DashboardTimeframeTabs basePath="/" timeframe={timeframe} />
        </div>
      </div>

      {aiWarning ? <OperationalWarningBanner warning={aiWarning} /> : null}

      <WatchlistSearch
        watchlistCount={watchlistEntries.length}
        watchlistLimit={watchlistLimit}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section aria-label="Ranked assets" className="grid gap-3.5">
          {items.length === 0 ? (
            <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h3]:m-0 [&_h3]:text-[0.95rem] [&_p]:m-0 [&_p]:text-ink-2">
              <h3>No data yet</h3>
              <p>
                The analysis worker hasn't stored any snapshots for this
                timeframe. Data appears here after the first analysis cycle
                completes.
              </p>
              {overviewResult.issues.map((issue) => (
                <p key={issue} className="text-[0.85rem] text-muted-foreground">
                  {issue}
                </p>
              ))}
            </article>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5 sm:grid-cols-1">
              {items.map((item) => {
                const watchlistEntry = watchlistEntryByAssetId.get(
                  item.asset.id,
                );

                return (
                  <Link
                    key={`${item.asset.id}:${item.timeframe}`}
                    className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 transition-colors duration-140 hover:border-input hover:bg-secondary"
                    href={`/assets/${item.asset.symbol.toLowerCase()}?timeframe=${timeframe}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CoinLogo
                          imageUrl={readAssetImageUrl(item.asset.metadata)}
                          size={34}
                          symbol={item.asset.symbol}
                        />
                        <div>
                          <p className="m-0 text-[1.15rem] font-bold">
                            {item.asset.symbol}
                          </p>
                          <p className="mt-0.5 mb-0 text-[0.85rem] text-muted-foreground">
                            {item.asset.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
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

                    <div className="flex items-baseline gap-3">
                      <strong className="text-[1.6rem] font-bold tracking-[-0.01em] tabular-nums">
                        {formatPrice(item.lastPrice)}
                      </strong>
                      <DeltaText value={item.priceChangePercent} />
                    </div>

                    <div className="grid gap-2.5">
                      <ScoreBar
                        label="Signal"
                        value={item.signalStrengthScore}
                      />
                      <ScoreBar
                        label="AI confidence"
                        value={item.aiConfidence}
                      />
                    </div>

                    <p className="m-0 text-[0.9rem] leading-[1.55] text-ink-2">
                      {item.summary ?? "Waiting for the first analysis."}
                    </p>

                    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.82rem] tabular-nums text-muted-foreground">
                      <span>
                        S{" "}
                        <strong className="font-semibold text-up">
                          {formatPrice(item.nearestSupport)}
                        </strong>
                      </span>
                      <span>
                        R{" "}
                        <strong className="font-semibold text-accent">
                          {formatPrice(item.nearestResistance)}
                        </strong>
                      </span>
                      <span>
                        Inv{" "}
                        <strong className="font-semibold text-down">
                          {formatPrice(item.invalidation)}
                        </strong>
                      </span>
                    </div>

                    {item.keyReasons.length > 0 ? (
                      <ul className="m-0 pl-4.5 text-[0.85rem] leading-[1.6] text-muted-foreground">
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
            <article className="mt-3.5 grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h3]:m-0 [&_h3]:text-[0.95rem]">
              <h3>Waiting for first analysis</h3>
              <ul className="m-0 grid list-none gap-1 p-0">
                {pendingEntries.map((entry) => (
                  <li
                    key={entry.asset.id}
                    className="flex items-center justify-between gap-2.5 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CoinLogo
                        imageUrl={readAssetImageUrl(entry.asset.metadata)}
                        size={22}
                        symbol={entry.asset.symbol}
                      />
                      <strong>{entry.asset.symbol}</strong>
                      <span className="overflow-hidden text-[0.84rem] text-ellipsis whitespace-nowrap text-muted-foreground">
                        {entry.asset.name}
                      </span>
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

        <section aria-label="Alerts and system status" className="grid gap-3.5">
          <PortfolioOverviewCard
            data={portfolioResult.data}
            issues={portfolioResult.issues}
            message={portfolioResult.message}
          />
          <AlertFeed
            alerts={alerts}
            emptyMessage="No alerts for this timeframe yet. Alerts appear when an asset changes state."
            issues={alertsResult.issues}
            message={alertsResult.message}
            title="Recent Alerts"
          />
        </section>
      </div>
    </main>
  );
}
