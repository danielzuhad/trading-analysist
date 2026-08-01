import {
  type Alert,
  type AlertKind,
  type AlertSeverity,
  type AssetState,
  alertSchema,
  type LatestAssetAnalysis,
  type SupportedTimeframe,
} from "@trading-analyst/shared-types";

export const defaultAlertUserId = "system:default";

export type GenerateStateTransitionAlertOptions = {
  createdAt?: string;
  currentAnalysis: LatestAssetAnalysis;
  previousAnalysis: LatestAssetAnalysis | null;
  userId?: string;
};

export type GenerateStateTransitionAlertResult =
  | {
      alert: Alert;
      reason: "state_changed";
      status: "created";
    }
  | {
      reason:
        | "missing_previous_analysis"
        | "state_unchanged"
        | "unsupported_timeframe";
      status: "skipped";
    };

export function generateStateTransitionAlert({
  createdAt,
  currentAnalysis,
  previousAnalysis,
  userId = defaultAlertUserId,
}: GenerateStateTransitionAlertOptions): GenerateStateTransitionAlertResult {
  if (!previousAnalysis) {
    return {
      reason: "missing_previous_analysis",
      status: "skipped",
    };
  }

  if (previousAnalysis.state === currentAnalysis.state) {
    return {
      reason: "state_unchanged",
      status: "skipped",
    };
  }

  const timeframe = toSupportedTimeframe(
    currentAnalysis.marketSnapshot.timeframe,
  );

  if (!timeframe) {
    return {
      reason: "unsupported_timeframe",
      status: "skipped",
    };
  }

  const transitionId = buildTransitionId({
    currentAnalysis,
    fromState: previousAnalysis.state,
    timeframe,
    toState: currentAnalysis.state,
  });
  const dedupeKey = buildAlertDedupeKey({
    currentAnalysis,
    fromState: previousAnalysis.state,
    timeframe,
    toState: currentAnalysis.state,
  });

  return {
    alert: alertSchema.parse({
      id: `alert:${dedupeKey}`,
      userId,
      assetId: currentAnalysis.asset.id,
      ...(currentAnalysis.position?.id
        ? { positionId: currentAnalysis.position.id }
        : previousAnalysis.position?.id
          ? { positionId: previousAnalysis.position.id }
          : {}),
      analysisId: currentAnalysis.id,
      transitionId,
      timeframe,
      dedupeKey,
      kind: resolveAlertKind(previousAnalysis, currentAnalysis),
      severity: resolveAlertSeverity(
        previousAnalysis.state,
        currentAnalysis.state,
      ),
      status: "suggested",
      channels: ["dashboard", "telegram", "whatsapp"],
      title: buildAlertTitle(currentAnalysis),
      message: buildAlertMessage(previousAnalysis.state, currentAnalysis),
      summary: currentAnalysis.decisionCard.summary,
      previousState: previousAnalysis.state,
      currentState: currentAnalysis.state,
      suggestion: currentAnalysis.suggestion,
      createdAt: createdAt ?? currentAnalysis.generatedAt,
      isStale: false,
      metadata: {
        aiConfidence: currentAnalysis.aiConfidence,
        previousAnalysisGeneratedAt: previousAnalysis.generatedAt,
        previousAnalysisId: previousAnalysis.id,
        signalStrengthScore: currentAnalysis.signalStrengthScore,
        snapshotHash: currentAnalysis.snapshotHash,
        triggeredBy: currentAnalysis.triggeredBy,
      },
    }),
    reason: "state_changed",
    status: "created",
  };
}

function resolveAlertKind(
  previousAnalysis: LatestAssetAnalysis,
  currentAnalysis: LatestAssetAnalysis,
): AlertKind {
  if (
    currentAnalysis.position ||
    previousAnalysis.position ||
    currentAnalysis.state === "IN_POSITION" ||
    currentAnalysis.state === "EXIT_WARNING"
  ) {
    return "position";
  }

  return "market";
}

function resolveAlertSeverity(
  fromState: AssetState,
  toState: AssetState,
): AlertSeverity {
  if (
    toState === "ACTIONABLE" ||
    toState === "EXIT_WARNING" ||
    toState === "INVALID"
  ) {
    return "critical";
  }

  if (toState === "PREPARE" || toState === "IN_POSITION") {
    return "warning";
  }

  if (fromState === "ACTIONABLE" || fromState === "EXIT_WARNING") {
    return "warning";
  }

  return "info";
}

function buildAlertTitle(currentAnalysis: LatestAssetAnalysis) {
  const symbol = currentAnalysis.asset.displaySymbol;

  switch (currentAnalysis.state) {
    case "ACTIONABLE":
      return `${symbol} actionable setup`;
    case "EXIT_WARNING":
      return `${symbol} exit warning`;
    case "IGNORE":
      return `${symbol} moved to ignore`;
    case "IN_POSITION":
      return `${symbol} position state active`;
    case "INVALID":
      return `${symbol} setup invalidated`;
    case "PREPARE":
      return `${symbol} setup moved to prepare`;
    case "WATCH":
      return `${symbol} moved back to watch`;
  }
}

function buildAlertMessage(
  previousState: AssetState,
  currentAnalysis: LatestAssetAnalysis,
) {
  const base = `${currentAnalysis.asset.displaySymbol} changed from ${previousState} to ${currentAnalysis.state}. ${currentAnalysis.summary}`;
  const positionContext = buildPositionContext(previousState, currentAnalysis);

  return positionContext ? `${base} ${positionContext}` : base;
}

/**
 * Explains *why* the plan changed when an open position is involved, since
 * position-aware analysis swaps the invalidation level for the position's
 * own stop loss rather than a purely technical level — that's a change in
 * what the state transition means, not just a new label.
 */
function buildPositionContext(
  previousState: AssetState,
  currentAnalysis: LatestAssetAnalysis,
): string | undefined {
  const position = currentAnalysis.position;

  if (!position) {
    return undefined;
  }

  const directionLabel = position.direction === "long" ? "long" : "short";

  if (
    previousState !== "IN_POSITION" &&
    currentAnalysis.state === "IN_POSITION"
  ) {
    return `This reflects your open ${directionLabel} position — the invalidation level below is now your stop loss, not a general technical level.`;
  }

  if (currentAnalysis.state === "EXIT_WARNING") {
    return `Your open ${directionLabel} position is at risk — price is approaching the level that would trigger your stop loss.`;
  }

  if (
    previousState === "IN_POSITION" &&
    currentAnalysis.state !== "IN_POSITION"
  ) {
    return `You still have an open ${directionLabel} position on this asset; this analysis no longer treats it as the active setup.`;
  }

  return undefined;
}

function buildTransitionId({
  currentAnalysis,
  fromState,
  timeframe,
  toState,
}: {
  currentAnalysis: LatestAssetAnalysis;
  fromState: AssetState;
  timeframe: SupportedTimeframe;
  toState: AssetState;
}) {
  return `transition:${currentAnalysis.asset.id}:${timeframe}:${fromState}->${toState}:${currentAnalysis.snapshotHash}`;
}

function buildAlertDedupeKey({
  currentAnalysis,
  fromState,
  timeframe,
  toState,
}: {
  currentAnalysis: LatestAssetAnalysis;
  fromState: AssetState;
  timeframe: SupportedTimeframe;
  toState: AssetState;
}) {
  return `${currentAnalysis.asset.id}:${timeframe}:${fromState}->${toState}:${currentAnalysis.snapshotHash}`;
}

function toSupportedTimeframe(
  timeframe: LatestAssetAnalysis["marketSnapshot"]["timeframe"],
): SupportedTimeframe | null {
  if (timeframe === "1H" || timeframe === "4H") {
    return timeframe;
  }

  return null;
}
