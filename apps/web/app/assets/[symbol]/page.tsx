import { findDefaultCryptoAssetBySymbol } from "@trading-analyst/shared-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchAssetOverview,
  resolveDashboardTimeframe,
} from "../../../dashboard";
import { loadWebEnv } from "../../../env";
import {
  formatPercent,
  formatPrice,
  formatScore,
} from "../../dashboard-format";
import {
  DashboardTimeframeTabs,
  MissingDataList,
  OverviewStatusBadge,
  StateBadge,
} from "../../dashboard-primitives";
import { recordPositionAction } from "./actions";

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

export default async function AssetDetailPage({
  params,
  searchParams,
}: AssetDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const asset = findDefaultCryptoAssetBySymbol(resolvedParams.symbol);

  if (!asset) {
    notFound();
  }

  const timeframe = resolveDashboardTimeframe(resolvedSearchParams?.timeframe);
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const overviewResult = await fetchAssetOverview(
    apiBaseUrl,
    asset.id,
    timeframe,
  );
  const overview = overviewResult.data;
  const positionStatus = Array.isArray(resolvedSearchParams?.positionStatus)
    ? resolvedSearchParams.positionStatus[0]
    : resolvedSearchParams?.positionStatus;
  const activePosition = overview?.activePosition;

  return (
    <main className="shell shell--detail">
      <section className="hero hero--detail">
        <div className="hero-copy">
          <Link className="back-link" href={`/?timeframe=${timeframe}`}>
            Back to watchlist
          </Link>
          <p className="eyebrow">Asset Detail</p>
          <h1>
            {asset.name}{" "}
            <span className="hero-subtitle">{asset.displaySymbol}</span>
          </h1>
          <p className="lede">
            Read-only snapshot for the selected timeframe. This page combines
            the latest market read model, indicator output, signal aggregation,
            and AI analysis when available.
          </p>
        </div>

        <div className="hero-actions">
          <DashboardTimeframeTabs
            basePath={`/assets/${asset.symbol.toLowerCase()}`}
            timeframe={timeframe}
          />
          <div className="hero-metrics">
            <article className="hero-metric-card">
              <span className="hero-metric-label">Asset scope</span>
              <strong>{asset.symbol}</strong>
              <p>Seeded MVP asset from the internal crypto watchlist.</p>
            </article>
            <article className="hero-metric-card">
              <span className="hero-metric-label">Overview status</span>
              <strong>{overview?.status ?? overviewResult.status}</strong>
              <p>{overviewResult.message}</p>
            </article>
          </div>
        </div>
      </section>

      {overview ? (
        <>
          <section className="detail-summary-grid">
            <article className="card card--summary">
              <div className="card-heading">
                <h2>Current Snapshot</h2>
                <OverviewStatusBadge status={overview.status} />
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <span>Last price</span>
                  <strong>
                    {formatPrice(overview.marketSnapshot?.lastPrice)}
                  </strong>
                </div>
                <div className="metric">
                  <span>Signal score</span>
                  <strong>
                    {formatScore(overview.signalSnapshot?.signalStrengthScore)}
                  </strong>
                </div>
                <div className="metric">
                  <span>AI confidence</span>
                  <strong>
                    {formatScore(overview.analysisSnapshot?.aiConfidence)}
                  </strong>
                </div>
              </div>
              <div className="asset-card__meta">
                <StateBadge state={overview.analysisSnapshot?.state} />
                <span className="inline-chip">{timeframe}</span>
                <span className="inline-chip">
                  {overview.marketSnapshot?.provider ?? "No provider data"}
                </span>
              </div>
              <MissingDataList items={overview.missingData} />
            </article>

            <article className="card card--summary">
              <div className="card-heading">
                <h2>AI Decision</h2>
                <StateBadge state={overview.analysisSnapshot?.state} />
              </div>
              <p>
                {overview.analysisSnapshot?.summary ??
                  "No AI analysis is stored yet for this asset and timeframe."}
              </p>
              <div className="asset-card__levels">
                <span>
                  Support{" "}
                  {formatPrice(
                    overview.analysisSnapshot?.keyLevels.nearestSupport,
                  )}
                </span>
                <span>
                  Resistance{" "}
                  {formatPrice(
                    overview.analysisSnapshot?.keyLevels.nearestResistance,
                  )}
                </span>
                <span>
                  Invalidation{" "}
                  {formatPrice(
                    overview.analysisSnapshot?.keyLevels.invalidation,
                  )}
                </span>
              </div>
            </article>

            <article className="card card--summary">
              <div className="card-heading">
                <h2>Manual Position</h2>
                <OverviewStatusBadge
                  status={activePosition ? "ready" : "pending"}
                />
              </div>

              {activePosition ? (
                <div className="detail-list">
                  <p>Direction: {activePosition.direction}</p>
                  <p>Status: {activePosition.status}</p>
                  <p>Entry: {formatPrice(activePosition.averageEntryPrice)}</p>
                  <p>Quantity: {activePosition.remainingQuantity}</p>
                  <p>Stop loss: {formatPrice(activePosition.stopLoss)}</p>
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

              {positionStatus ? (
                <p className="issue-text">Position status: {positionStatus}</p>
              ) : null}
            </article>
          </section>

          <section className="detail-grid">
            <article className="card">
              <h2>Market Snapshot</h2>
              <div className="detail-list">
                <p>
                  Captured at:{" "}
                  {overview.marketSnapshot?.capturedAt ?? "Unavailable"}
                </p>
                <p>
                  Provider: {overview.marketSnapshot?.provider ?? "Unavailable"}
                </p>
                <p>Open: {formatPrice(overview.marketSnapshot?.candle.open)}</p>
                <p>High: {formatPrice(overview.marketSnapshot?.candle.high)}</p>
                <p>Low: {formatPrice(overview.marketSnapshot?.candle.low)}</p>
                <p>
                  Close: {formatPrice(overview.marketSnapshot?.candle.close)}
                </p>
                <p>
                  Change:{" "}
                  {formatPercent(overview.marketSnapshot?.priceChangePercent)}
                </p>
              </div>
            </article>

            <article className="card">
              <h2>Indicator Snapshot</h2>
              <div className="detail-list">
                <p>
                  EMA20:{" "}
                  {formatPrice(
                    overview.indicatorSnapshot?.movingAverages.ema20,
                  )}
                </p>
                <p>
                  EMA50:{" "}
                  {formatPrice(
                    overview.indicatorSnapshot?.movingAverages.ema50,
                  )}
                </p>
                <p>
                  EMA200:{" "}
                  {formatPrice(
                    overview.indicatorSnapshot?.movingAverages.ema200,
                  )}
                </p>
                <p>
                  RSI14:{" "}
                  {overview.indicatorSnapshot?.oscillators.rsi14 ??
                    "Unavailable"}
                </p>
                <p>
                  ATR %:{" "}
                  {formatPercent(
                    overview.indicatorSnapshot?.volatility.atrPercent,
                  )}
                </p>
                <p>
                  Structure:{" "}
                  {overview.indicatorSnapshot?.structure ?? "Unavailable"}
                </p>
              </div>
            </article>

            <article className="card">
              <h2>Signal Snapshot</h2>
              <div className="detail-list">
                <p>Bias: {overview.signalSnapshot?.bias ?? "Unavailable"}</p>
                <p>
                  Regime: {overview.signalSnapshot?.regime ?? "Unavailable"}
                </p>
                <p>
                  Score:{" "}
                  {formatScore(overview.signalSnapshot?.signalStrengthScore)}
                </p>
                <p>
                  Summary:{" "}
                  {overview.signalSnapshot?.summary ??
                    "No signal snapshot is stored yet."}
                </p>
              </div>
              {overview.signalSnapshot?.riskFlags.length ? (
                <ul className="asset-card__list">
                  {overview.signalSnapshot.riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : null}
            </article>

            <article className="card">
              <h2>AI Analysis</h2>
              <div className="detail-list">
                <p>
                  Suggestion:{" "}
                  {overview.analysisSnapshot?.suggestion ?? "Unavailable"}
                </p>
                <p>
                  Generated at:{" "}
                  {overview.analysisSnapshot?.generatedAt ?? "Unavailable"}
                </p>
                <p>
                  Prompt version:{" "}
                  {overview.analysisSnapshot?.promptVersion ?? "Unavailable"}
                </p>
                <p>
                  Model: {overview.analysisSnapshot?.modelUsed ?? "Unavailable"}
                </p>
              </div>
              {overview.analysisSnapshot?.decisionCard.keyReasons.length ? (
                <ul className="asset-card__list">
                  {overview.analysisSnapshot.decisionCard.keyReasons.map(
                    (reason) => (
                      <li key={reason}>{reason}</li>
                    ),
                  )}
                </ul>
              ) : null}
              {overview.analysisSnapshot?.concerns.length ? (
                <ul className="asset-card__list">
                  {overview.analysisSnapshot.concerns.map((concern) => (
                    <li key={concern}>{concern}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          </section>
        </>
      ) : (
        <section className="detail-grid">
          <article className="card">
            <h2>Asset overview unavailable</h2>
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
