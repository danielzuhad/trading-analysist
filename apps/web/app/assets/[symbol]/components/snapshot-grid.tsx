import type { AssetOverviewResponse } from "@trading-analyst/shared-types";
import { DetailRow } from "@/components/dashboard/dashboard-primitives";
import {
  formatPercent,
  formatPrice,
  formatRelativeTime,
  mapDeltaClass,
} from "@/lib/dashboard-format";

function mapChangeClass(value?: number) {
  const deltaClass = mapDeltaClass(value);
  return deltaClass === "flat"
    ? "text-muted-foreground"
    : deltaClass === "up"
      ? "text-up"
      : "text-down";
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

const cardClassName =
  "grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base";

export function SnapshotGrid({
  overview,
}: {
  overview: AssetOverviewResponse;
}) {
  return (
    <section
      className="grid grid-cols-2 gap-3.5 lg:grid-cols-1"
      aria-label="Snapshots"
    >
      <article className={cardClassName}>
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
            value={formatPercent(overview.marketSnapshot?.priceChangePercent)}
            valueClass={mapChangeClass(
              overview.marketSnapshot?.priceChangePercent,
            )}
          />
          <DetailRow
            label="Captured"
            value={formatRelativeTime(overview.marketSnapshot?.capturedAt)}
          />
        </div>
      </article>

      <article className={cardClassName}>
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

      <article className={`${cardClassName} [&>p]:m-0 [&>p]:text-ink-2`}>
        <h2>Signal</h2>
        <div className="grid gap-2">
          <DetailRow
            label="Bias"
            value={overview.signalSnapshot?.bias}
            valueClass={mapBiasClass(overview.signalSnapshot?.bias)}
          />
          <DetailRow label="Regime" value={overview.signalSnapshot?.regime} />
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
          {overview.signalSnapshot?.summary ?? "No signal snapshot stored yet."}
        </p>
        {overview.signalSnapshot?.riskFlags.length ? (
          <ul className="m-0 pl-4.5 text-[0.85rem] leading-[1.6] text-muted-foreground">
            {overview.signalSnapshot.riskFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        ) : null}
      </article>
    </section>
  );
}
