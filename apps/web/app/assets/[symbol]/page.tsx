import { findDefaultCryptoAssetBySymbol } from "@trading-analyst/shared-types";
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
import { removeFromWatchlistAndRedirectAction } from "@/lib/watchlist-actions";
import {
  closePositionAction,
  recordPositionAction,
  updatePositionAction,
} from "./actions";

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
    <div className="level-bar">
      <div className="level-bar__track">
        {support !== undefined ? (
          <span
            className="level-bar__marker level-bar__marker--support"
            style={{ left: `${position(support)}%` }}
            title={`Support ${formatPrice(support)}`}
          />
        ) : null}
        {resistance !== undefined ? (
          <span
            className="level-bar__marker level-bar__marker--resistance"
            style={{ left: `${position(resistance)}%` }}
            title={`Resistance ${formatPrice(resistance)}`}
          />
        ) : null}
        {invalidation !== undefined ? (
          <span
            className="level-bar__marker level-bar__marker--invalidation"
            style={{ left: `${position(invalidation)}%` }}
            title={`Invalidation ${formatPrice(invalidation)}`}
          />
        ) : null}
        <span
          className="level-bar__marker level-bar__marker--price"
          style={{ left: `${position(price)}%` }}
          title={`Price ${formatPrice(price)}`}
        />
      </div>
      <div className="level-bar__legend">
        {support !== undefined ? (
          <span>
            <i style={{ background: "var(--up)" }} />
            Support {formatPrice(support)}
          </span>
        ) : null}
        {resistance !== undefined ? (
          <span>
            <i style={{ background: "var(--accent)" }} />
            Resistance {formatPrice(resistance)}
          </span>
        ) : null}
        {invalidation !== undefined ? (
          <span>
            <i style={{ background: "var(--down)" }} />
            Invalidation {formatPrice(invalidation)}
          </span>
        ) : null}
        <span>
          <i style={{ background: "var(--ink)" }} />
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
    <p>
      <span>{label}</span>
      <span className={valueClass}>{value ?? "—"}</span>
    </p>
  );
}

function mapChangeClass(value?: number) {
  const deltaClass = mapDeltaClass(value);
  return deltaClass === "flat" ? "value--muted" : `value--${deltaClass}`;
}

function mapBiasClass(bias?: string) {
  if (bias === "bullish") {
    return "value--up";
  }

  if (bias === "bearish") {
    return "value--down";
  }

  return "value--muted";
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
    <main className="shell">
      <div className="detail-header">
        <Link className="back-link" href={`/?timeframe=${timeframe}`}>
          ← Watchlist
        </Link>
        <div className="detail-header__row">
          <div className="detail-header__identity">
            <CoinLogo
              imageUrl={readAssetImageUrl(asset.metadata)}
              size={40}
              symbol={asset.symbol}
            />
            <h1>{asset.symbol}</h1>
            <p className="asset-card__name">{asset.name}</p>
            <StateBadge state={analysis?.state} />
          </div>
          <DashboardTimeframeTabs
            basePath={`/assets/${asset.symbol.toLowerCase()}`}
            timeframe={timeframe}
          />
        </div>
        <div className="detail-header__row">
          <div className="detail-price">
            <strong>{formatPrice(overview?.marketSnapshot?.lastPrice)}</strong>
            <DeltaText value={overview?.marketSnapshot?.priceChangePercent} />
          </div>
          <div className="page-heading__meta">
            <span className="inline-chip">
              Updated {formatRelativeTime(overview?.marketSnapshot?.capturedAt)}
            </span>
            <span className="inline-chip">
              {overview?.marketSnapshot?.provider ?? "no provider"}
            </span>
            {!activePosition ? (
              <form
                className="remove-watchlist-form"
                action={removeFromWatchlistAndRedirectAction.bind(
                  null,
                  asset.id,
                )}
              >
                <button type="submit">Remove from watchlist</button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      {aiWarning ? <OperationalWarningBanner warning={aiWarning} /> : null}

      {overview ? (
        <>
          <section className="decision-card" aria-label="AI decision">
            <div className="card-heading">
              <h2>AI Decision</h2>
              <div className="page-heading__meta">
                {analysis?.suggestion ? (
                  <span className="inline-chip">
                    {analysis.suggestion.replaceAll("_", " ")}
                  </span>
                ) : null}
                <StateBadge state={analysis?.state} />
              </div>
            </div>

            <p className="decision-card__summary">
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
              <div className="decision-card__grid">
                <div className="decision-block">
                  <span className="decision-block__label">Action plan</span>
                  <ul>
                    {decision.actionPlan.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
                <div className="decision-block decision-block--invalidation">
                  <span className="decision-block__label">Invalidation</span>
                  <p>{decision.invalidation}</p>
                </div>
                <div className="decision-block">
                  <span className="decision-block__label">Key reasons</span>
                  <ul>
                    {decision.keyReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <div className="decision-block">
                  <span className="decision-block__label">
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

            <div className="score-row">
              <ScoreBar
                label="Signal"
                value={overview.signalSnapshot?.signalStrengthScore}
              />
              <ScoreBar label="AI confidence" value={analysis?.aiConfidence} />
            </div>

            <div className="page-heading__meta">
              <span className="inline-chip">
                {analysis?.modelUsed ?? "no model"}
              </span>
              <span className="inline-chip">
                Generated {formatRelativeTime(analysis?.generatedAt)}
              </span>
              {analysis?.suggestedPositionSize ? (
                <span className="inline-chip">
                  Size: {analysis.suggestedPositionSize}
                </span>
              ) : null}
            </div>
            <MissingDataList items={overview.missingData} />
          </section>

          <section className="detail-grid" aria-label="Snapshots">
            <article className="card">
              <h2>Market</h2>
              <div className="detail-list">
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

            <article className="card">
              <h2>Indicators</h2>
              <div className="detail-list">
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

            <article className="card">
              <h2>Signal</h2>
              <div className="detail-list">
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
                <ul className="asset-card__list">
                  {overview.signalSnapshot.riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : null}
            </article>

            <article className="card" id={manualPositionAnchorId}>
              <div className="card-heading">
                <h2>Manual Position</h2>
                <span className="inline-chip">
                  {activePosition ? "active" : "none"}
                </span>
              </div>

              {positionStatusMessage ? (
                <p
                  className={`action-banner action-banner--${positionStatusTone}`}
                  role="status"
                >
                  {positionStatusMessage}
                </p>
              ) : null}

              {activePosition ? (
                <div className="position-stack">
                  <div className="detail-list">
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

                  <form className="position-form" action={updatePositionAction}>
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
                    <label>
                      Average Entry
                      <input
                        name="averageEntryPrice"
                        type="number"
                        step="any"
                        min="0"
                        defaultValue={activePosition.averageEntryPrice}
                        required
                      />
                    </label>
                    <label>
                      Remaining Quantity
                      <input
                        name="remainingQuantity"
                        type="number"
                        step="any"
                        min="0"
                        defaultValue={activePosition.remainingQuantity}
                        required
                      />
                    </label>
                    <label>
                      Status
                      <select
                        name="status"
                        defaultValue={activePosition.status}
                      >
                        <option value="open">Open</option>
                        <option value="partially_closed">
                          Partially Closed
                        </option>
                      </select>
                    </label>
                    <label>
                      Stop
                      <input
                        name="stopLoss"
                        type="number"
                        step="any"
                        min="0"
                        defaultValue={activePosition.stopLoss ?? ""}
                      />
                    </label>
                    <label className="position-form__wide">
                      Thesis
                      <input
                        name="thesis"
                        type="text"
                        defaultValue={activePosition.thesis ?? ""}
                      />
                    </label>
                    <label className="position-form__wide">
                      Notes
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={activePosition.notes ?? ""}
                      />
                    </label>
                    <button type="submit">Save Position Update</button>
                  </form>

                  <form
                    className="position-form position-form--close"
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
                    <label>
                      Realized PnL
                      <input
                        name="realizedPnl"
                        type="number"
                        step="any"
                        defaultValue={activePosition.realizedPnl ?? ""}
                      />
                    </label>
                    <label>
                      Realized PnL %
                      <input
                        name="realizedPnlPercent"
                        type="number"
                        step="any"
                        defaultValue={activePosition.realizedPnlPercent ?? ""}
                      />
                    </label>
                    <label className="position-form__wide">
                      Close Notes
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={activePosition.notes ?? ""}
                      />
                    </label>
                    <button className="button--danger" type="submit">
                      Close Position
                    </button>
                  </form>
                </div>
              ) : (
                <form className="position-form" action={recordPositionAction}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <input
                    type="hidden"
                    name="symbol"
                    value={asset.symbol.toLowerCase()}
                  />
                  <input type="hidden" name="timeframe" value={timeframe} />
                  <label>
                    Direction
                    <select name="direction" defaultValue="long">
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </label>
                  <label>
                    Entry
                    <input
                      name="entryPrice"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={overview.marketSnapshot?.lastPrice ?? ""}
                      required
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      step="any"
                      min="0"
                      required
                    />
                  </label>
                  <label>
                    Stop
                    <input name="stopLoss" type="number" step="any" min="0" />
                  </label>
                  <label className="position-form__wide">
                    Thesis
                    <input name="thesis" type="text" />
                  </label>
                  <button type="submit">Record Position</button>
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
        <section className="detail-grid">
          <article className="card">
            <h2>Asset data unavailable</h2>
            <p>{overviewResult.message}</p>
            {overviewResult.issues.map((issue) => (
              <p key={issue} className="issue-text">
                {issue}
              </p>
            ))}
          </article>
        </section>
      )}
    </main>
  );
}
