import type {
  AssetState,
  OverviewStatus,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatMissingDataLabel,
  formatPercent,
  formatScore,
  mapAssetStateClass,
  mapDeltaClass,
  mapOverviewStatusTone,
  mapScoreClass,
} from "@/lib/dashboard-format";

type DashboardTimeframeTabsProps = {
  basePath: string;
  timeframe: SupportedTimeframe;
};

type Tone = "active" | "degraded" | "disabled" | "down";

export function DashboardTimeframeTabs({
  basePath,
  timeframe,
}: DashboardTimeframeTabsProps) {
  const timeframes: SupportedTimeframe[] = ["1H", "4H"];

  return (
    <nav className="timeframe-tabs" aria-label="Timeframe selector">
      {timeframes.map((entry) => (
        <Link
          key={entry}
          className={`timeframe-tab${entry === timeframe ? " timeframe-tab--active" : ""}`}
          href={`${basePath}?timeframe=${entry}`}
        >
          {entry}
        </Link>
      ))}
    </nav>
  );
}

export function StateBadge({ state }: { state: AssetState | undefined }) {
  return (
    <span className={`state-badge state-badge--${mapAssetStateClass(state)}`}>
      {state?.replaceAll("_", " ") ?? "No AI state"}
    </span>
  );
}

export function OverviewStatusBadge({ status }: { status: OverviewStatus }) {
  return <ToneBadge tone={mapOverviewStatusTone(status)}>{status}</ToneBadge>;
}

export function DeltaText({ value }: { value?: number | undefined }) {
  return (
    <span className={`delta delta--${mapDeltaClass(value)}`}>
      {value === undefined ? "—" : formatPercent(value)}
    </span>
  );
}

export function ScoreBar({
  label,
  value,
}: {
  label: string;
  value?: number | undefined;
}) {
  const clamped =
    value === undefined ? 0 : Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="score-bar">
      <span className="score-bar__label">
        {label}
        <strong>{value === undefined ? "—" : formatScore(value)}</strong>
      </span>
      <div className="score-bar__track" aria-hidden="true">
        <div
          className={`score-bar__fill score-bar__fill--${mapScoreClass(value)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function MissingDataList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="missing-data-list">
      {items.map((item) => (
        <span key={item} className="inline-chip">
          {formatMissingDataLabel(item)}
        </span>
      ))}
    </div>
  );
}

function ToneBadge({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <span className={`status-badge status-badge--${tone}`}>{children}</span>
  );
}
