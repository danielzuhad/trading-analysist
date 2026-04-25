import type {
  AssetState,
  OverviewStatus,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatMissingDataLabel,
  mapAssetStateTone,
  mapOverviewStatusTone,
} from "./dashboard-format";

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
    <ToneBadge tone={mapAssetStateTone(state)}>
      {state ?? "No AI State"}
    </ToneBadge>
  );
}

export function OverviewStatusBadge({ status }: { status: OverviewStatus }) {
  return <ToneBadge tone={mapOverviewStatusTone(status)}>{status}</ToneBadge>;
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
