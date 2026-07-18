import type {
  Alert,
  AssetState,
  OverviewStatus,
} from "@trading-analyst/shared-types";

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

export function formatAlertTimestamp(value?: string) {
  return value === undefined
    ? "Unavailable"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
}

export function formatAlertStateTransition(
  alert: Pick<Alert, "currentState" | "previousState">,
) {
  return alert.previousState
    ? `${alert.previousState} -> ${alert.currentState}`
    : alert.currentState;
}

export function formatPositionStatusMessage(value?: string) {
  switch (value) {
    case "recorded":
      return "Position recorded successfully.";
    case "record-failed":
      return "Failed to record position.";
    case "updated":
      return "Position updated successfully.";
    case "update-failed":
      return "Failed to update position.";
    case "closed":
      return "Position closed successfully.";
    case "close-failed":
      return "Failed to close position.";
    case "api":
      return "API base URL is not configured.";
    default:
      return undefined;
  }
}

export function mapPositionStatusTone(value?: string) {
  if (value === "recorded" || value === "updated" || value === "closed") {
    return "success";
  }

  if (
    value === "record-failed" ||
    value === "update-failed" ||
    value === "close-failed"
  ) {
    return "error";
  }

  return "muted";
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

export function mapAlertSeverityTone(alert: Pick<Alert, "severity">) {
  if (alert.severity === "critical") {
    return "down";
  }

  if (alert.severity === "warning") {
    return "degraded";
  }

  return "active";
}
