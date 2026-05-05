import type {
  Alert,
  AssetOverviewResponse,
  Position,
  WatchlistOverviewResponse,
} from "@trading-analyst/shared-types";

const helpCommandText = [
  "Commands:",
  "WATCHLIST 4H",
  "ASSET BTC 4H",
  "POSITION BTC LONG ENTRY 84000 QTY 0.10 STOP 82000",
  "CLOSE BTC",
].join("\n");

export function formatAlertDeliveryMessage(alert: Alert) {
  return truncateMessage(
    [
      alert.title,
      `${alert.assetId.split(":").at(-1) ?? alert.assetId} ${alert.timeframe} | ${alert.previousState ?? "n/a"} -> ${alert.currentState}`,
      alert.summary,
      ...(alert.suggestion ? [`Suggestion: ${alert.suggestion}`] : []),
    ].join("\n"),
  );
}

export function formatAssetOverviewMessage(response: AssetOverviewResponse) {
  const stateLabel =
    response.analysisSnapshot?.state ??
    response.signalSnapshot?.regime?.toUpperCase() ??
    response.status.toUpperCase();

  return truncateMessage(
    [
      `${response.asset.displaySymbol} ${response.timeframe}`,
      `Status: ${stateLabel}`,
      `Price: ${formatPrice(response.marketSnapshot?.lastPrice)} | Signal: ${formatScore(response.signalSnapshot?.signalStrengthScore ?? response.analysisSnapshot?.signalStrengthScore)} | AI: ${formatScore(response.analysisSnapshot?.aiConfidence)}`,
      response.analysisSnapshot?.summary ??
        response.signalSnapshot?.summary ??
        "Belum ada snapshot analisis lengkap.",
      `Support: ${formatPrice(response.analysisSnapshot?.keyLevels.nearestSupport ?? response.signalSnapshot?.keyLevels.nearestSupport)} | Resistance: ${formatPrice(response.analysisSnapshot?.keyLevels.nearestResistance ?? response.signalSnapshot?.keyLevels.nearestResistance)} | Invalid: ${formatPrice(response.analysisSnapshot?.keyLevels.invalidation ?? response.signalSnapshot?.keyLevels.invalidation)}`,
      response.activePosition
        ? `Active position: ${response.activePosition.direction} @ ${formatPrice(response.activePosition.averageEntryPrice)} qty ${formatDecimal(response.activePosition.remainingQuantity)}`
        : "Active position: none",
    ].join("\n"),
  );
}

export function formatChatLayerDisabledMessage() {
  return "WhatsApp chat layer belum dikonfigurasi di server ini.";
}

export function formatHelpMessage() {
  return helpCommandText;
}

export function formatInvalidCommandMessage(message: string) {
  return [message, "", helpCommandText].join("\n");
}

export function formatPositionClosedMessage(position: Position) {
  return truncateMessage(
    [
      `${position.assetId.split(":").at(-1) ?? position.assetId} position closed`,
      `Direction: ${position.direction}`,
      `Entry: ${formatPrice(position.averageEntryPrice)}`,
      `Closed at: ${position.closedAt ?? position.lastUpdatedAt}`,
    ].join("\n"),
  );
}

export function formatPositionRecordedMessage(position: Position) {
  return truncateMessage(
    [
      `${position.assetId.split(":").at(-1) ?? position.assetId} position recorded`,
      `Direction: ${position.direction}`,
      `Entry: ${formatPrice(position.entryPrice)}`,
      `Quantity: ${formatDecimal(position.quantity)}`,
      `Stop: ${formatPrice(position.stopLoss)}`,
    ].join("\n"),
  );
}

export function formatUnknownCommandMessage() {
  return ["Command tidak dikenali.", "", helpCommandText].join("\n");
}

export function formatWatchlistMessage(response: WatchlistOverviewResponse) {
  const lines = response.items.map((item, index) => {
    const state = item.state ?? item.status.toUpperCase();
    const summary = item.summary
      ? ` | ${truncateInline(item.summary, 70)}`
      : "";

    return `${index + 1}. ${item.asset.symbol} ${state} | score ${formatScore(item.signalStrengthScore)} | AI ${formatScore(item.aiConfidence)}${summary}`;
  });

  return truncateMessage(
    [`Watchlist ${response.timeframe}`, ...lines].join("\n"),
  );
}

function formatDecimal(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  return value.toFixed(4).replace(/\.?0+$/u, "");
}

function formatPrice(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  if (value >= 1000) {
    return `$${value.toFixed(0)}`;
  }

  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }

  return `$${value.toFixed(4)}`;
}

function formatScore(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  return `${Math.round(value)}`;
}

function truncateInline(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function truncateMessage(value: string, maxLength = 1400) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
