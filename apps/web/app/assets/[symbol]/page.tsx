import { findDefaultCryptoAssetBySymbol } from "@trading-analyst/shared-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertFeed } from "@/components/dashboard/alert-feed";
import { CoinLogo } from "@/components/dashboard/coin-logo";
import {
  DashboardTimeframeTabs,
  DeltaText,
  InfoPill,
  StateBadge,
} from "@/components/dashboard/dashboard-primitives";
import { OperationalWarningBanner } from "@/components/dashboard/operational-warning-banner";
import { SearchParamStatusToast } from "@/components/dashboard/search-param-status-toast";
import {
  fetchAlerts,
  fetchAssetOverview,
  fetchWatchlist,
  resolveDashboardTimeframe,
} from "@/lib/dashboard";
import {
  formatPositionStatusMessage,
  formatPrice,
  formatRelativeTime,
  mapPositionStatusTone,
  readAssetImageUrl,
} from "@/lib/dashboard-format";
import { loadWebEnv } from "@/lib/env";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
} from "@/lib/status";
import { removeFromWatchlistAndRedirectAction } from "@/lib/watchlist-actions";
import { AiDecisionSection } from "./components/ai-decision-section";
import { ManualPositionCard } from "./components/manual-position-card";
import { SnapshotGrid } from "./components/snapshot-grid";

export const dynamic = "force-dynamic";

type AssetDetailPageProps = {
  params: Promise<{
    symbol: string;
  }>;
  searchParams?: Promise<{
    positionStatus?: string | string[];
    timeframe?: string | string[];
    watchlistStatus?: string | string[];
  }>;
};

export default async function AssetDetailPage({
  params,
  searchParams,
}: AssetDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  let asset = findDefaultCryptoAssetBySymbol(resolvedParams.symbol);

  if (!asset) {
    const watchlist = await fetchWatchlist(apiBaseUrl);
    const normalizedSymbol = resolvedParams.symbol.trim().toUpperCase();
    asset = watchlist.data?.entries.find(
      (entry) => entry.asset.symbol.toUpperCase() === normalizedSymbol,
    )?.asset;
  }

  if (!asset) {
    notFound();
  }

  const timeframe = resolveDashboardTimeframe(resolvedSearchParams?.timeframe);
  const [overviewResult, alertsResult, infrastructureStatus] =
    await Promise.all([
      fetchAssetOverview(apiBaseUrl, asset.id, timeframe),
      fetchAlerts(apiBaseUrl, {
        assetId: asset.id,
        limit: 5,
        timeframe,
      }),
      fetchInfrastructureStatus(apiBaseUrl),
    ]);
  const overview = overviewResult.data;
  const alerts = alertsResult.data?.alerts ?? [];
  const aiWarning = buildAiOperationalWarning(infrastructureStatus);
  const positionStatus = Array.isArray(resolvedSearchParams?.positionStatus)
    ? resolvedSearchParams.positionStatus[0]
    : resolvedSearchParams?.positionStatus;
  const positionStatusMessage = formatPositionStatusMessage(positionStatus);
  const positionStatusTone = mapPositionStatusTone(positionStatus);
  const watchlistStatus = Array.isArray(resolvedSearchParams?.watchlistStatus)
    ? resolvedSearchParams.watchlistStatus[0]
    : resolvedSearchParams?.watchlistStatus;
  const watchlistStatusMessage =
    watchlistStatus === "remove-failed"
      ? "This asset has an active position. Close the position before removing it."
      : undefined;
  const activePosition = overview?.activePosition;
  const analysis = overview?.analysisSnapshot;

  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <div className="grid gap-3.5">
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-[0.88rem] text-muted-foreground hover:text-foreground"
          href={`/?timeframe=${timeframe}`}
        >
          ← Watchlist
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <CoinLogo
              imageUrl={readAssetImageUrl(asset.metadata)}
              size={40}
              symbol={asset.symbol}
            />
            <h1 className="m-0 text-2xl tracking-[-0.01em]">{asset.symbol}</h1>
            <p className="m-0 text-[0.95rem] text-muted-foreground">
              {asset.name}
            </p>
            <StateBadge state={analysis?.state} />
          </div>
          <DashboardTimeframeTabs
            basePath={`/assets/${asset.symbol.toLowerCase()}`}
            timeframe={timeframe}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-baseline gap-3">
            <strong className="text-[2rem] font-bold tracking-[-0.02em] tabular-nums sm:text-[1.6rem]">
              {formatPrice(overview?.marketSnapshot?.lastPrice)}
            </strong>
            <DeltaText value={overview?.marketSnapshot?.priceChangePercent} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <InfoPill>
              Updated {formatRelativeTime(overview?.marketSnapshot?.capturedAt)}
            </InfoPill>
            <InfoPill>
              {overview?.marketSnapshot?.provider ?? "no provider"}
            </InfoPill>
            {!activePosition ? (
              <form
                className="inline"
                action={removeFromWatchlistAndRedirectAction.bind(
                  null,
                  asset.id,
                  asset.symbol.toLowerCase(),
                )}
              >
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 text-[0.8rem] text-muted-foreground hover:border-down/40 hover:text-down"
                >
                  Remove from watchlist
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <SearchParamStatusToast
        message={watchlistStatusMessage}
        paramName="watchlistStatus"
        tone="error"
      />

      {aiWarning ? <OperationalWarningBanner warning={aiWarning} /> : null}

      {overview ? (
        <>
          <AiDecisionSection overview={overview} />

          <SnapshotGrid overview={overview} />

          <ManualPositionCard
            activePosition={activePosition}
            asset={asset}
            lastPrice={overview.marketSnapshot?.lastPrice}
            positionStatusMessage={positionStatusMessage}
            positionStatusTone={positionStatusTone}
            timeframe={timeframe}
          />

          <AlertFeed
            alerts={alerts}
            emptyMessage="No alerts for this asset yet."
            issues={alertsResult.issues}
            message={alertsResult.message}
            title="Asset Alerts"
          />
        </>
      ) : (
        <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
          <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base [&_p]:m-0 [&_p]:text-ink-2">
            <h2>Asset data unavailable</h2>
            <p>{overviewResult.message}</p>
            {overviewResult.issues.map((issue) => (
              <p key={issue} className="text-[0.85rem] text-muted-foreground">
                {issue}
              </p>
            ))}
          </article>
        </section>
      )}
    </main>
  );
}
