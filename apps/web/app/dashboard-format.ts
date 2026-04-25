import type { AssetState, OverviewStatus } from "@trading-analyst/shared-types";

const priceFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: "always",
});

export function formatPrice(value?: number) {
  return value === undefined ? "Unavailable" : priceFormatter.format(value);
}

export function formatPercent(value?: number) {
  return value === undefined
    ? "Unavailable"
    : `${percentFormatter.format(value)}%`;
}

export function formatScore(value?: number) {
  return value === undefined ? "Unavailable" : `${Math.round(value)}/100`;
}

export function formatMissingDataLabel(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function mapAssetStateTone(state?: AssetState) {
  if (state === "ACTIONABLE" || state === "IN_POSITION") {
    return "active";
  }

  if (state === "PREPARE" || state === "WATCH") {
    return "degraded";
  }

  if (state === "EXIT_WARNING" || state === "INVALID") {
    return "down";
  }

  return "disabled";
}

export function mapOverviewStatusTone(status: OverviewStatus) {
  if (status === "ready") {
    return "active";
  }

  if (status === "partial") {
    return "degraded";
  }

  return "disabled";
}
