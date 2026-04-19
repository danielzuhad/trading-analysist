import { createHash } from "node:crypto";
import {
  type AnalysisBias,
  type Asset,
  type IndicatorSnapshot,
  type MarketRegime,
  type MarketSnapshot,
  type Position,
  type SignalAggregationSnapshot,
  type SignalKeyLevels,
  type SignalLabel,
  signalAggregationSnapshotSchema,
} from "@trading-analyst/shared-types";

export type BuildSignalAggregationSnapshotOptions = {
  asset: Asset;
  generatedAt?: string;
  indicatorSnapshot: IndicatorSnapshot;
  marketSnapshot: MarketSnapshot;
  position?: Position;
};

type SignalAggregationSnapshotWithoutHash = Omit<
  SignalAggregationSnapshot,
  "snapshotHash"
>;

type SignalLabelInput = {
  details: string;
  key: string;
  scoreContribution: number;
  sentiment: AnalysisBias;
  title: string;
};

const signalAggregationVersion = "signal-aggregation:v1";

export function buildSignalAggregationSnapshot({
  asset,
  generatedAt = new Date().toISOString(),
  indicatorSnapshot,
  marketSnapshot,
  position,
}: BuildSignalAggregationSnapshotOptions): SignalAggregationSnapshot {
  validateMatchingSources(asset, marketSnapshot, indicatorSnapshot, position);

  const keyLevels = buildKeyLevels(marketSnapshot, indicatorSnapshot, position);
  const labels = buildLabels(marketSnapshot, indicatorSnapshot);
  const bias = deriveBias(labels);
  const regime = deriveRegime(marketSnapshot, indicatorSnapshot);
  const riskFlags = buildRiskFlags(
    marketSnapshot,
    indicatorSnapshot,
    keyLevels,
    position,
  );
  const signalStrengthScore = clampScore(
    labels.reduce((total, label) => total + label.scoreContribution, 0),
  );
  const summary = buildSummary({
    bias,
    labels,
    regime,
    riskFlags,
  });

  const baseSnapshot: SignalAggregationSnapshotWithoutHash = {
    id: buildSignalAggregationId(
      asset.id,
      marketSnapshot.timeframe,
      generatedAt,
    ),
    asset,
    marketSnapshot,
    indicatorSnapshot,
    ...(position ? { position } : {}),
    generatedAt,
    signalStrengthScore,
    bias,
    regime,
    timeframeRelevance: buildTimeframeRelevance(
      marketSnapshot.timeframe,
      position,
    ),
    riskFlags,
    keyLevels,
    labels,
    summary,
    metadata: {
      indicatorSnapshotId: indicatorSnapshot.id,
      labelCount: labels.length,
      marketSnapshotId: marketSnapshot.id,
      ...(position ? { positionId: position.id } : {}),
      signalAggregationVersion,
    },
  };

  const snapshotHash = buildSignalAggregationSnapshotHash(baseSnapshot);

  return signalAggregationSnapshotSchema.parse({
    ...baseSnapshot,
    snapshotHash,
  });
}

export function buildSignalAggregationSnapshotHash(
  snapshot: SignalAggregationSnapshotWithoutHash | SignalAggregationSnapshot,
) {
  const normalized = removeSnapshotHash(snapshot);
  return createHash("sha256").update(stableStringify(normalized)).digest("hex");
}

function buildLabels(
  marketSnapshot: MarketSnapshot,
  indicatorSnapshot: IndicatorSnapshot,
): SignalLabel[] {
  return [
    buildTrendLabel(marketSnapshot, indicatorSnapshot),
    buildMomentumLabel(indicatorSnapshot),
    buildVolumeLabel(indicatorSnapshot),
    buildVolatilityLabel(indicatorSnapshot),
    buildStructureLabel(indicatorSnapshot),
  ];
}

function buildTrendLabel(
  marketSnapshot: MarketSnapshot,
  indicatorSnapshot: IndicatorSnapshot,
): SignalLabel {
  const close = marketSnapshot.candle.close;
  const { ema20, ema50, ema200 } = indicatorSnapshot.movingAverages;

  if (close > ema20 && ema20 > ema50 && ema50 > ema200) {
    return createSignalLabel({
      details: "Price holds above a fully bullish EMA20/EMA50/EMA200 stack.",
      key: "trend_alignment",
      scoreContribution: 30,
      sentiment: "bullish",
      title: "Trend Alignment",
    });
  }

  if (close < ema20 && ema20 < ema50 && ema50 < ema200) {
    return createSignalLabel({
      details: "Price remains below a fully bearish EMA20/EMA50/EMA200 stack.",
      key: "trend_alignment",
      scoreContribution: 30,
      sentiment: "bearish",
      title: "Trend Alignment",
    });
  }

  if (close > ema20 && ema20 > ema50) {
    return createSignalLabel({
      details: "Short-term trend remains constructive above EMA20 and EMA50.",
      key: "trend_alignment",
      scoreContribution: 22,
      sentiment: "bullish",
      title: "Trend Alignment",
    });
  }

  if (close < ema20 && ema20 < ema50) {
    return createSignalLabel({
      details: "Short-term trend remains weak below EMA20 and EMA50.",
      key: "trend_alignment",
      scoreContribution: 22,
      sentiment: "bearish",
      title: "Trend Alignment",
    });
  }

  return createSignalLabel({
    details:
      "Price and moving averages are not aligned enough for a clean trend.",
    key: "trend_alignment",
    scoreContribution: 12,
    sentiment: "mixed",
    title: "Trend Alignment",
  });
}

function buildMomentumLabel(indicatorSnapshot: IndicatorSnapshot): SignalLabel {
  const rsi = indicatorSnapshot.oscillators.rsi14;

  if (rsi >= 58 && rsi <= 68) {
    return createSignalLabel({
      details:
        "RSI sits in a healthy bullish momentum zone without looking stretched.",
      key: "momentum",
      scoreContribution: 20,
      sentiment: "bullish",
      title: "Momentum",
    });
  }

  if (rsi > 68 && rsi < 80) {
    return createSignalLabel({
      details: "RSI confirms upside momentum, but the move is getting crowded.",
      key: "momentum",
      scoreContribution: 14,
      sentiment: "bullish",
      title: "Momentum",
    });
  }

  if (rsi >= 45 && rsi < 58) {
    return createSignalLabel({
      details:
        "RSI is neutral-to-firm and does not add strong directional pressure.",
      key: "momentum",
      scoreContribution: 10,
      sentiment: "neutral",
      title: "Momentum",
    });
  }

  if (rsi > 30 && rsi < 45) {
    return createSignalLabel({
      details: "RSI remains on the weak side and confirms softer momentum.",
      key: "momentum",
      scoreContribution: 16,
      sentiment: "bearish",
      title: "Momentum",
    });
  }

  return createSignalLabel({
    details:
      "RSI is stretched enough to add exhaustion risk rather than clean confirmation.",
    key: "momentum",
    scoreContribution: 8,
    sentiment: rsi >= 80 ? "mixed" : "bearish",
    title: "Momentum",
  });
}

function buildVolumeLabel(indicatorSnapshot: IndicatorSnapshot): SignalLabel {
  const { relativeVolume, trend } = indicatorSnapshot.volume;

  if (relativeVolume === undefined) {
    return createSignalLabel({
      details: "Volume context is incomplete, so conviction remains moderate.",
      key: "volume",
      scoreContribution: 7,
      sentiment: "neutral",
      title: "Volume Confirmation",
    });
  }

  if (relativeVolume >= 1.2 && trend === "up") {
    return createSignalLabel({
      details:
        "Volume expands above baseline and confirms constructive participation.",
      key: "volume",
      scoreContribution: 15,
      sentiment: "bullish",
      title: "Volume Confirmation",
    });
  }

  if (relativeVolume >= 1.2 && trend === "down") {
    return createSignalLabel({
      details: "Heavy participation is confirming downside pressure.",
      key: "volume",
      scoreContribution: 13,
      sentiment: "bearish",
      title: "Volume Confirmation",
    });
  }

  if (relativeVolume <= 0.8 && trend === "down") {
    return createSignalLabel({
      details:
        "Volume is fading and tilting weaker, which reduces bullish conviction.",
      key: "volume",
      scoreContribution: 11,
      sentiment: "bearish",
      title: "Volume Confirmation",
    });
  }

  if (trend === "flat") {
    return createSignalLabel({
      details:
        "Volume is roughly in line with baseline and does not confirm urgency.",
      key: "volume",
      scoreContribution: 8,
      sentiment: "neutral",
      title: "Volume Confirmation",
    });
  }

  return createSignalLabel({
    details: "Volume context is mixed and adds only moderate confirmation.",
    key: "volume",
    scoreContribution: 9,
    sentiment: "mixed",
    title: "Volume Confirmation",
  });
}

function buildVolatilityLabel(
  indicatorSnapshot: IndicatorSnapshot,
): SignalLabel {
  switch (indicatorSnapshot.volatility.regime) {
    case "normal":
      return createSignalLabel({
        details:
          "Volatility is near baseline, which is healthy for measured analysis.",
        key: "volatility",
        scoreContribution: 15,
        sentiment: "neutral",
        title: "Volatility",
      });
    case "compressed":
      return createSignalLabel({
        details:
          "Compressed volatility can precede expansion, but it still needs confirmation.",
        key: "volatility",
        scoreContribution: 11,
        sentiment: "neutral",
        title: "Volatility",
      });
    case "expanded":
      return createSignalLabel({
        details:
          "Expanded volatility raises execution risk and usually needs cleaner levels.",
        key: "volatility",
        scoreContribution: 8,
        sentiment: "mixed",
        title: "Volatility",
      });
    case "extreme":
      return createSignalLabel({
        details:
          "Extreme volatility increases whipsaw risk and weakens confidence.",
        key: "volatility",
        scoreContribution: 4,
        sentiment: "mixed",
        title: "Volatility",
      });
  }
}

function buildStructureLabel(
  indicatorSnapshot: IndicatorSnapshot,
): SignalLabel {
  switch (indicatorSnapshot.structure) {
    case "uptrend":
      return createSignalLabel({
        details: "Market structure remains in an established uptrend.",
        key: "structure",
        scoreContribution: 20,
        sentiment: "bullish",
        title: "Structure",
      });
    case "downtrend":
      return createSignalLabel({
        details: "Market structure remains in an established downtrend.",
        key: "structure",
        scoreContribution: 20,
        sentiment: "bearish",
        title: "Structure",
      });
    case "range":
      return createSignalLabel({
        details:
          "Market structure is range-bound and favors patience over conviction.",
        key: "structure",
        scoreContribution: 10,
        sentiment: "neutral",
        title: "Structure",
      });
    case "transition":
      return createSignalLabel({
        details:
          "Market structure is still transitioning and lacks clean directional clarity.",
        key: "structure",
        scoreContribution: 8,
        sentiment: "mixed",
        title: "Structure",
      });
  }
}

function deriveBias(labels: SignalLabel[]): AnalysisBias {
  const bullishScore = sumContributions(labels, "bullish");
  const bearishScore = sumContributions(labels, "bearish");
  const mixedScore = sumContributions(labels, "mixed");

  if (
    bullishScore >= 20 &&
    bearishScore >= 20 &&
    Math.abs(bullishScore - bearishScore) <= 8
  ) {
    return "mixed";
  }

  if (Math.abs(bullishScore - bearishScore) <= 6) {
    return mixedScore >= 12 ? "mixed" : "neutral";
  }

  return bullishScore > bearishScore ? "bullish" : "bearish";
}

function deriveRegime(
  marketSnapshot: MarketSnapshot,
  indicatorSnapshot: IndicatorSnapshot,
): MarketRegime {
  const eventFlags = new Set(
    marketSnapshot.eventFlags.map((flag) => flag.trim().toLowerCase()),
  );

  if ([...eventFlags].some((flag) => flag.includes("breakdown"))) {
    return "breakdown";
  }

  if ([...eventFlags].some((flag) => flag.includes("breakout"))) {
    return "breakout";
  }

  if (indicatorSnapshot.volatility.regime === "extreme") {
    return "volatile";
  }

  if (indicatorSnapshot.structure === "range") {
    return "range";
  }

  if (
    indicatorSnapshot.structure === "uptrend" ||
    indicatorSnapshot.structure === "downtrend"
  ) {
    return "trend";
  }

  if (indicatorSnapshot.volatility.regime === "expanded") {
    return "volatile";
  }

  return "unknown";
}

function buildRiskFlags(
  marketSnapshot: MarketSnapshot,
  indicatorSnapshot: IndicatorSnapshot,
  keyLevels: SignalKeyLevels,
  position?: Position,
) {
  const riskFlags = new Set<string>();
  const close = marketSnapshot.candle.close;
  const { atr14, regime } = indicatorSnapshot.volatility;
  const relativeVolume = indicatorSnapshot.volume.relativeVolume;
  const rsi = indicatorSnapshot.oscillators.rsi14;

  if (rsi >= 70) {
    riskFlags.add("rsi_overheated");
  }

  if (rsi <= 30) {
    riskFlags.add("rsi_oversold");
  }

  if (regime === "expanded") {
    riskFlags.add("volatility_expanded");
  }

  if (regime === "extreme") {
    riskFlags.add("volatility_extreme");
  }

  if (relativeVolume !== undefined && relativeVolume < 0.85) {
    riskFlags.add("low_relative_volume");
  }

  if (relativeVolume !== undefined && relativeVolume >= 1.8) {
    riskFlags.add("volume_climax");
  }

  if (
    keyLevels.nearestResistance !== undefined &&
    keyLevels.nearestResistance - close <= atr14
  ) {
    riskFlags.add("price_near_resistance");
  }

  if (
    keyLevels.nearestSupport !== undefined &&
    close - keyLevels.nearestSupport <= atr14
  ) {
    riskFlags.add("price_near_support");
  }

  if (
    position?.stopLoss !== undefined &&
    isPriceNearInvalidation(close, atr14, position)
  ) {
    riskFlags.add("position_near_invalidation");
  }

  return [...riskFlags];
}

function buildKeyLevels(
  marketSnapshot: MarketSnapshot,
  indicatorSnapshot: IndicatorSnapshot,
  position?: Position,
): SignalKeyLevels {
  const close = marketSnapshot.candle.close;
  const nearestSupport = findNearestSupport(
    indicatorSnapshot.levels.support,
    close,
  );
  const nearestResistance = findNearestResistance(
    indicatorSnapshot.levels.resistance,
    close,
  );
  const invalidation = buildInvalidationLevel(
    close,
    indicatorSnapshot.volatility.atr14,
    nearestSupport,
    nearestResistance,
    position,
  );

  return {
    ...(nearestSupport !== undefined ? { nearestSupport } : {}),
    ...(nearestResistance !== undefined ? { nearestResistance } : {}),
    ...(invalidation !== undefined ? { invalidation } : {}),
  };
}

function buildInvalidationLevel(
  close: number,
  atr14: number,
  nearestSupport: number | undefined,
  nearestResistance: number | undefined,
  position?: Position,
) {
  if (position?.stopLoss !== undefined) {
    return position.stopLoss;
  }

  if (nearestSupport !== undefined) {
    return Math.max(0, Number((nearestSupport - atr14 * 0.5).toFixed(4)));
  }

  if (nearestResistance !== undefined) {
    return Number((nearestResistance + atr14 * 0.5).toFixed(4));
  }

  return Math.max(0, Number((close - atr14).toFixed(4)));
}

function buildSummary({
  bias,
  labels,
  regime,
  riskFlags,
}: {
  bias: AnalysisBias;
  labels: SignalLabel[];
  regime: MarketRegime;
  riskFlags: string[];
}) {
  const [primaryLabel, secondaryLabel] = [...labels].sort(
    (left, right) => right.scoreContribution - left.scoreContribution,
  );
  const biasText = capitalize(bias);
  const primaryText = primaryLabel?.title.toLowerCase() ?? "signal context";
  const secondaryText =
    secondaryLabel?.title.toLowerCase() ?? "supporting data";
  const riskText =
    riskFlags.length > 0 ? ` Watch ${riskFlags[0]?.replaceAll("_", " ")}.` : "";

  return `${biasText} ${regime} context led by ${primaryText} and ${secondaryText}.${riskText}`;
}

function buildTimeframeRelevance(
  timeframe: MarketSnapshot["timeframe"],
  position?: Position,
) {
  if (timeframe === "1H") {
    return position
      ? "Fast monitoring layer for active setups and open positions."
      : "Fast confirmation layer for crypto watchlist monitoring.";
  }

  return position
    ? "Higher-timeframe thesis check for position management."
    : "Higher-timeframe swing context for crypto watchlist monitoring.";
}

function validateMatchingSources(
  asset: Asset,
  marketSnapshot: MarketSnapshot,
  indicatorSnapshot: IndicatorSnapshot,
  position?: Position,
) {
  if (asset.id !== marketSnapshot.assetId) {
    throw new Error(
      `Signal aggregation requires asset.id (${asset.id}) to match marketSnapshot.assetId (${marketSnapshot.assetId}).`,
    );
  }

  if (asset.id !== indicatorSnapshot.assetId) {
    throw new Error(
      `Signal aggregation requires asset.id (${asset.id}) to match indicatorSnapshot.assetId (${indicatorSnapshot.assetId}).`,
    );
  }

  if (marketSnapshot.timeframe !== indicatorSnapshot.timeframe) {
    throw new Error(
      `Signal aggregation requires matching timeframes, received ${marketSnapshot.timeframe} and ${indicatorSnapshot.timeframe}.`,
    );
  }

  if (position && position.assetId !== asset.id) {
    throw new Error(
      `Signal aggregation requires position.assetId (${position.assetId}) to match asset.id (${asset.id}).`,
    );
  }
}

function isPriceNearInvalidation(
  close: number,
  atr14: number,
  position: Position,
) {
  if (position.stopLoss === undefined) {
    return false;
  }

  if (position.direction === "long") {
    return close - position.stopLoss <= atr14;
  }

  return position.stopLoss - close <= atr14;
}

function findNearestSupport(levels: number[], close: number) {
  return levels.find((level) => level < close);
}

function findNearestResistance(levels: number[], close: number) {
  return levels.find((level) => level > close);
}

function sumContributions(labels: SignalLabel[], sentiment: AnalysisBias) {
  return labels
    .filter((label) => label.sentiment === sentiment)
    .reduce((total, label) => total + label.scoreContribution, 0);
}

function createSignalLabel(input: SignalLabelInput): SignalLabel {
  return {
    ...input,
    scoreContribution: clampScore(input.scoreContribution),
  };
}

function buildSignalAggregationId(
  assetId: string,
  timeframe: string,
  generatedAt: string,
) {
  return `signal:${assetId}:${timeframe}:${generatedAt}`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function removeSnapshotHash(
  snapshot: SignalAggregationSnapshotWithoutHash | SignalAggregationSnapshot,
): SignalAggregationSnapshotWithoutHash {
  if (!("snapshotHash" in snapshot)) {
    return snapshot;
  }

  const { snapshotHash: _snapshotHash, ...rest } = snapshot;
  return rest;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}
