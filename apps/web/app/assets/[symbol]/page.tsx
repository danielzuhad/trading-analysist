import { findDefaultCryptoAssetBySymbol } from "@trading-analyst/shared-types";
import { cva } from "class-variance-authority";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertFeed } from "@/components/dashboard/alert-feed";
import { CoinLogo } from "@/components/dashboard/coin-logo";
import {
  DashboardTimeframeTabs,
  DeltaText,
  MissingDataList,
  ScoreBar,
  StateBadge,
} from "@/components/dashboard/dashboard-primitives";
import { OperationalWarningBanner } from "@/components/dashboard/operational-warning-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAlerts,
  fetchAssetOverview,
  fetchWatchlist,
  resolveDashboardTimeframe,
} from "@/lib/dashboard";
import {
  formatPercent,
  formatPositionStatusMessage,
  formatPrice,
  formatRelativeTime,
  mapDeltaClass,
  mapPositionStatusTone,
  readAssetImageUrl,
} from "@/lib/dashboard-format";
import { loadWebEnv } from "@/lib/env";
import { manualPositionAnchorId } from "@/lib/position-action-payload";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
} from "@/lib/status";
import { cn } from "@/lib/utils";
import { removeFromWatchlistAndRedirectAction } from "@/lib/watchlist-actions";
import {
  closePositionAction,
  recordPositionAction,
  updatePositionAction,
} from "./actions";

const nativeSelectClassName =
  "min-h-10 w-full rounded-sm border border-input bg-secondary px-3 text-foreground tabular-nums focus:outline-2 focus:outline-primary focus:outline-offset-1";

const positionFieldLabelClassName =
  "grid gap-1.5 text-[0.74rem] font-semibold tracking-widest text-muted-foreground uppercase";

const positionInputClassName =
  "min-h-10 rounded-sm border-input bg-secondary tabular-nums tracking-normal normal-case focus-visible:border-input focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";

const actionBannerVariants = cva("m-0 rounded-sm border p-2.5 text-[0.9rem] font-semibold", {
  variants: {
    tone: {
      success: "border-up/30 bg-up-soft text-up",
      error: "border-down/30 bg-red-soft text-down",
      muted: "border-border bg-secondary text-muted-foreground",
    },
  },
});

export const dynamic = "force-dynamic";

type AssetDetailPageProps = {
  params: Promise<{
    symbol: string;
  }>;
  searchParams?: Promise<{
    positionStatus?: string | string[];
    timeframe?: string | string[];
  }>;
};

function LevelBar({
  invalidation,
  price,
  resistance,
  support,
}: {
  invalidation?: number | undefined;
  price?: number | undefined;
  resistance?: number | undefined;
  support?: number | undefined;
}) {
  const values = [support, resistance, invalidation, price].filter(
    (value): value is number => value !== undefined,
  );

  if (price === undefined || values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || max * 0.01 || 1) * 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const position = (value: number) => ((value - lo) / (hi - lo)) * 100;

  return (
    <div className="grid gap-2">
      <div className="relative h-2 rounded-full bg-secondary">
        {support !== undefined ? (
          <span
            className="absolute top-1/2 h-4 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-up"
            style={{ left: `${position(support)}%` }}
            title={`Support ${formatPrice(support)}`}
          />
        ) : null}
        {resistance !== undefined ? (
          <span
            className="absolute top-1/2 h-4 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-accent"
            style={{ left: `${position(resistance)}%` }}
            title={`Resistance ${formatPrice(resistance)}`}
          />
        ) : null}
        {invalidation !== undefined ? (
          <span
            className="absolute top-1/2 h-4 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-down"
            style={{ left: `${position(invalidation)}%` }}
            title={`Invalidation ${formatPrice(invalidation)}`}
          />
        ) : null}
        <span
          className="absolute top-1/2 h-2.75 w-2.75 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
          style={{ left: `${position(price)}%` }}
          title={`Price ${formatPrice(price)}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8rem] tabular-nums text-muted-foreground">
        {support !== undefined ? (
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-up not-italic" />
            Support {formatPrice(support)}
          </span>
        ) : null}
        {resistance !== undefined ? (
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-accent not-italic" />
            Resistance {formatPrice(resistance)}
          </span>
        ) : null}
        {invalidation !== undefined ? (
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-down not-italic" />
            Invalidation {formatPrice(invalidation)}
          </span>
        ) : null}
        <span>
          <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-foreground not-italic" />
          Price {formatPrice(price)}
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value?: string | number | undefined;
  valueClass?: string | undefined;
}) {
  return (
    <p className="m-0 flex justify-between gap-3 text-[0.9rem] text-ink-2 [&>span:first-child]:text-muted-foreground [&>span:last-child]:text-right [&>span:last-child]:tabular-nums [&>span:last-child]:text-foreground">
      <span>{label}</span>
      <span className={valueClass}>{value ?? "—"}</span>
    </p>
  );
}

function mapChangeClass(value?: number) {
  const deltaClass = mapDeltaClass(value);
  return deltaClass === "flat" ? "text-muted-foreground" : deltaClass === "up" ? "text-up" : "text-down";
}

function mapBiasClass(bias?: string) {
  if (bias === "bullish") {
    return "text-up";
  }

  if (bias === "bearish") {
    return "text-down";
  }

  return "text-muted-foreground";
}

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
  const activePosition = overview?.activePosition;
  const analysis = overview?.analysisSnapshot;
  const decision = analysis?.decisionCard;

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
            <h1 className="m-0 text-2xl tracking-[-0.01em]">
              {asset.symbol}
            </h1>
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
            <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
              Updated {formatRelativeTime(overview?.marketSnapshot?.capturedAt)}
            </span>
            <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
              {overview?.marketSnapshot?.provider ?? "no provider"}
            </span>
            {!activePosition ? (
              <form
                className="inline"
                action={removeFromWatchlistAndRedirectAction.bind(
                  null,
                  asset.id,
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

      {aiWarning ? <OperationalWarningBanner warning={aiWarning} /> : null}

      {overview ? (
        <>
          <section
            className="grid gap-4 rounded-(--radius) border border-input bg-card p-5"
            aria-label="AI decision"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="m-0 text-base">AI Decision</h2>
              <div className="flex flex-wrap items-center gap-2.5">
                {analysis?.suggestion ? (
                  <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
                    {analysis.suggestion.replaceAll("_", " ")}
                  </span>
                ) : null}
                <StateBadge state={analysis?.state} />
              </div>
            </div>

            <p className="m-0 text-[1.02rem] leading-[1.6] text-foreground">
              {analysis?.summary ??
                "No AI analysis has been stored for this asset and timeframe yet."}
            </p>

            <LevelBar
              invalidation={analysis?.keyLevels.invalidation}
              price={overview.marketSnapshot?.lastPrice}
              resistance={analysis?.keyLevels.nearestResistance}
              support={analysis?.keyLevels.nearestSupport}
            />

            {decision ? (
              <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
                <div className="grid gap-1.5 rounded-sm border border-border bg-secondary p-3.5 [&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:leading-[1.6] [&_p]:text-ink-2 [&_ul]:m-0 [&_ul]:pl-4.5 [&_ul]:text-[0.9rem] [&_ul]:leading-[1.6] [&_ul]:text-ink-2">
                  <span className="text-[0.72rem] tracking-widest text-muted-foreground uppercase">
                    Action plan
                  </span>
                  <ul>
                    {decision.actionPlan.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-1.5 rounded-sm border border-down/35 bg-secondary p-3.5 [&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:leading-[1.6] [&_p]:text-ink-2 [&_ul]:m-0 [&_ul]:pl-4.5 [&_ul]:text-[0.9rem] [&_ul]:leading-[1.6] [&_ul]:text-ink-2">
                  <span className="text-[0.72rem] tracking-widest text-muted-foreground uppercase">
                    Invalidation
                  </span>
                  <p>{decision.invalidation}</p>
                </div>
                <div className="grid gap-1.5 rounded-sm border border-border bg-secondary p-3.5 [&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:leading-[1.6] [&_p]:text-ink-2 [&_ul]:m-0 [&_ul]:pl-4.5 [&_ul]:text-[0.9rem] [&_ul]:leading-[1.6] [&_ul]:text-ink-2">
                  <span className="text-[0.72rem] tracking-widest text-muted-foreground uppercase">
                    Key reasons
                  </span>
                  <ul>
                    {decision.keyReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-1.5 rounded-sm border border-border bg-secondary p-3.5 [&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:leading-[1.6] [&_p]:text-ink-2 [&_ul]:m-0 [&_ul]:pl-4.5 [&_ul]:text-[0.9rem] [&_ul]:leading-[1.6] [&_ul]:text-ink-2">
                  <span className="text-[0.72rem] tracking-widest text-muted-foreground uppercase">
                    Concerns · risk {decision.riskLevel}
                  </span>
                  {analysis?.concerns.length ? (
                    <ul>
                      {analysis.concerns.map((concern) => (
                        <li key={concern}>{concern}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No concerns recorded.</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2.5">
              <ScoreBar
                label="Signal"
                value={overview.signalSnapshot?.signalStrengthScore}
              />
              <ScoreBar label="AI confidence" value={analysis?.aiConfidence} />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
                {analysis?.modelUsed ?? "no model"}
              </span>
              <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
                Generated {formatRelativeTime(analysis?.generatedAt)}
              </span>
              {analysis?.suggestedPositionSize ? (
                <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
                  Size: {analysis.suggestedPositionSize}
                </span>
              ) : null}
            </div>
            <MissingDataList items={overview.missingData} />
          </section>

          <section
            className="grid grid-cols-2 gap-3.5 lg:grid-cols-1"
            aria-label="Snapshots"
          >
            <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base">
              <h2>Market</h2>
              <div className="grid gap-2">
                <DetailRow
                  label="Open"
                  value={formatPrice(overview.marketSnapshot?.candle.open)}
                />
                <DetailRow
                  label="High"
                  value={formatPrice(overview.marketSnapshot?.candle.high)}
                />
                <DetailRow
                  label="Low"
                  value={formatPrice(overview.marketSnapshot?.candle.low)}
                />
                <DetailRow
                  label="Close"
                  value={formatPrice(overview.marketSnapshot?.candle.close)}
                />
                <DetailRow
                  label="Change"
                  value={formatPercent(
                    overview.marketSnapshot?.priceChangePercent,
                  )}
                  valueClass={mapChangeClass(
                    overview.marketSnapshot?.priceChangePercent,
                  )}
                />
                <DetailRow
                  label="Captured"
                  value={formatRelativeTime(
                    overview.marketSnapshot?.capturedAt,
                  )}
                />
              </div>
            </article>

            <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base">
              <h2>Indicators</h2>
              <div className="grid gap-2">
                <DetailRow
                  label="EMA 20"
                  value={formatPrice(
                    overview.indicatorSnapshot?.movingAverages.ema20,
                  )}
                />
                <DetailRow
                  label="EMA 50"
                  value={formatPrice(
                    overview.indicatorSnapshot?.movingAverages.ema50,
                  )}
                />
                <DetailRow
                  label="EMA 200"
                  value={formatPrice(
                    overview.indicatorSnapshot?.movingAverages.ema200,
                  )}
                />
                <DetailRow
                  label="RSI 14"
                  value={overview.indicatorSnapshot?.oscillators.rsi14}
                />
                <DetailRow
                  label="ATR %"
                  value={formatPercent(
                    overview.indicatorSnapshot?.volatility.atrPercent,
                  )}
                />
                <DetailRow
                  label="Structure"
                  value={overview.indicatorSnapshot?.structure}
                />
              </div>
            </article>

            <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base [&>p]:m-0 [&>p]:text-ink-2">
              <h2>Signal</h2>
              <div className="grid gap-2">
                <DetailRow
                  label="Bias"
                  value={overview.signalSnapshot?.bias}
                  valueClass={mapBiasClass(overview.signalSnapshot?.bias)}
                />
                <DetailRow
                  label="Regime"
                  value={overview.signalSnapshot?.regime}
                />
                <DetailRow
                  label="Score"
                  value={
                    overview.signalSnapshot?.signalStrengthScore !== undefined
                      ? `${overview.signalSnapshot.signalStrengthScore}/100`
                      : undefined
                  }
                />
              </div>
              <p>
                {overview.signalSnapshot?.summary ??
                  "No signal snapshot stored yet."}
              </p>
              {overview.signalSnapshot?.riskFlags.length ? (
                <ul className="m-0 pl-4.5 text-[0.85rem] leading-[1.6] text-muted-foreground">
                  {overview.signalSnapshot.riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : null}
            </article>

            <article
              className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 scroll-mt-18 [&_h2]:m-0 [&_h2]:text-base"
              id={manualPositionAnchorId}
            >
              <div className="flex items-start justify-between gap-3">
                <h2>Manual Position</h2>
                <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
                  {activePosition ? "active" : "none"}
                </span>
              </div>

              {positionStatusMessage ? (
                <p className={actionBannerVariants({ tone: positionStatusTone })} role="status">
                  {positionStatusMessage}
                </p>
              ) : null}

              {activePosition ? (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <DetailRow
                      label="Direction"
                      value={activePosition.direction}
                    />
                    <DetailRow label="Status" value={activePosition.status} />
                    <DetailRow
                      label="Average entry"
                      value={formatPrice(activePosition.averageEntryPrice)}
                    />
                    <DetailRow
                      label="Remaining qty"
                      value={activePosition.remainingQuantity}
                    />
                    <DetailRow
                      label="Stop loss"
                      value={formatPrice(activePosition.stopLoss)}
                    />
                    <DetailRow
                      label="Opened"
                      value={formatRelativeTime(activePosition.openedAt)}
                    />
                  </div>

                  <form
                    className="grid grid-cols-2 gap-3 sm:grid-cols-1 [&>button]:col-span-full"
                    action={updatePositionAction}
                  >
                    <input
                      type="hidden"
                      name="positionId"
                      value={activePosition.id}
                    />
                    <input
                      type="hidden"
                      name="symbol"
                      value={asset.symbol.toLowerCase()}
                    />
                    <input type="hidden" name="timeframe" value={timeframe} />
                    <Label className={positionFieldLabelClassName}>
                      Average Entry
                      <Input
                        className={positionInputClassName}
                        name="averageEntryPrice"
                        type="number"
                        step="any"
                        min="0"
                        defaultValue={activePosition.averageEntryPrice}
                        required
                      />
                    </Label>
                    <Label className={positionFieldLabelClassName}>
                      Remaining Quantity
                      <Input
                        className={positionInputClassName}
                        name="remainingQuantity"
                        type="number"
                        step="any"
                        min="0"
                        defaultValue={activePosition.remainingQuantity}
                        required
                      />
                    </Label>
                    <Label className={positionFieldLabelClassName}>
                      Status
                      <select
                        className={nativeSelectClassName}
                        name="status"
                        defaultValue={activePosition.status}
                      >
                        <option value="open">Open</option>
                        <option value="partially_closed">
                          Partially Closed
                        </option>
                      </select>
                    </Label>
                    <Label className={positionFieldLabelClassName}>
                      Stop
                      <Input
                        className={positionInputClassName}
                        name="stopLoss"
                        type="number"
                        step="any"
                        min="0"
                        defaultValue={activePosition.stopLoss ?? ""}
                      />
                    </Label>
                    <Label
                      className={cn(positionFieldLabelClassName, "col-span-full")}
                    >
                      Thesis
                      <Input
                        className={positionInputClassName}
                        name="thesis"
                        type="text"
                        defaultValue={activePosition.thesis ?? ""}
                      />
                    </Label>
                    <Label
                      className={cn(positionFieldLabelClassName, "col-span-full")}
                    >
                      Notes
                      <Textarea
                        className={cn(positionInputClassName, "min-h-22 resize-y py-2.5")}
                        name="notes"
                        rows={3}
                        defaultValue={activePosition.notes ?? ""}
                      />
                    </Label>
                    <Button type="submit" className="col-span-full min-h-10">
                      Save Position Update
                    </Button>
                  </form>

                  <form
                    className="grid grid-cols-2 gap-3 border-t border-border pt-2 sm:grid-cols-1 [&>button]:col-span-full"
                    action={closePositionAction}
                  >
                    <input
                      type="hidden"
                      name="positionId"
                      value={activePosition.id}
                    />
                    <input
                      type="hidden"
                      name="symbol"
                      value={asset.symbol.toLowerCase()}
                    />
                    <input type="hidden" name="timeframe" value={timeframe} />
                    <Label className={positionFieldLabelClassName}>
                      Realized PnL
                      <Input
                        className={positionInputClassName}
                        name="realizedPnl"
                        type="number"
                        step="any"
                        defaultValue={activePosition.realizedPnl ?? ""}
                      />
                    </Label>
                    <Label className={positionFieldLabelClassName}>
                      Realized PnL %
                      <Input
                        className={positionInputClassName}
                        name="realizedPnlPercent"
                        type="number"
                        step="any"
                        defaultValue={activePosition.realizedPnlPercent ?? ""}
                      />
                    </Label>
                    <Label
                      className={cn(positionFieldLabelClassName, "col-span-full")}
                    >
                      Close Notes
                      <Textarea
                        className={cn(positionInputClassName, "min-h-22 resize-y py-2.5")}
                        name="notes"
                        rows={3}
                        defaultValue={activePosition.notes ?? ""}
                      />
                    </Label>
                    <Button
                      variant="destructive"
                      type="submit"
                      className="col-span-full min-h-10 bg-red text-white hover:bg-red/90"
                    >
                      Close Position
                    </Button>
                  </form>
                </div>
              ) : (
                <form
                  className="grid grid-cols-2 gap-3 sm:grid-cols-1 [&>button]:col-span-full"
                  action={recordPositionAction}
                >
                  <input type="hidden" name="assetId" value={asset.id} />
                  <input
                    type="hidden"
                    name="symbol"
                    value={asset.symbol.toLowerCase()}
                  />
                  <input type="hidden" name="timeframe" value={timeframe} />
                  <Label className={positionFieldLabelClassName}>
                    Direction
                    <select
                      className={nativeSelectClassName}
                      name="direction"
                      defaultValue="long"
                    >
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </Label>
                  <Label className={positionFieldLabelClassName}>
                    Entry
                    <Input
                      className={positionInputClassName}
                      name="entryPrice"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={overview.marketSnapshot?.lastPrice ?? ""}
                      required
                    />
                  </Label>
                  <Label className={positionFieldLabelClassName}>
                    Quantity
                    <Input
                      className={positionInputClassName}
                      name="quantity"
                      type="number"
                      step="any"
                      min="0"
                      required
                    />
                  </Label>
                  <Label className={positionFieldLabelClassName}>
                    Stop
                    <Input
                      className={positionInputClassName}
                      name="stopLoss"
                      type="number"
                      step="any"
                      min="0"
                    />
                  </Label>
                  <Label
                    className={cn(positionFieldLabelClassName, "col-span-full")}
                  >
                    Thesis
                    <Input
                      className={positionInputClassName}
                      name="thesis"
                      type="text"
                    />
                  </Label>
                  <Button type="submit" className="col-span-full min-h-10">
                    Record Position
                  </Button>
                </form>
              )}
            </article>
          </section>

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
