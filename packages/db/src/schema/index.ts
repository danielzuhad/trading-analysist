import type {
  IndicatorSnapshot,
  LatestAssetAnalysis,
  MarketCandle,
  MarketSnapshot,
  OhlcvCandle,
  SignalAggregationSnapshot,
} from "@trading-analyst/shared-types";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const serviceHeartbeats = pgTable("service_heartbeats", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceName: text("service_name").notNull().unique(),
  status: text("status").notNull(),
  payload: jsonb("payload")
    .$type<Record<string, unknown> | null>()
    .default(null),
  checkedAt: timestamp("checked_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const marketLatestSnapshots = pgTable("market_latest_snapshots", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  provider: text("provider").notNull(),
  timeframe: text("timeframe").notNull(),
  capturedAt: timestamp("captured_at", {
    withTimezone: true,
  }).notNull(),
  lastPrice: text("last_price").notNull(),
  bidPrice: text("bid_price"),
  askPrice: text("ask_price"),
  candle: jsonb("candle").$type<OhlcvCandle>().notNull(),
  candles: jsonb("candles").$type<MarketCandle[]>().notNull(),
  marketSession: text("market_session").notNull(),
  priceChangePercent: text("price_change_percent"),
  volumeWeightedAveragePrice: text("volume_weighted_average_price"),
  quoteCurrency: text("quote_currency"),
  baseCurrency: text("base_currency"),
  eventFlags: jsonb("event_flags").$type<string[]>().notNull(),
  metadata: jsonb("metadata").$type<MarketSnapshot["metadata"]>().notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const indicatorLatestSnapshots = pgTable("indicator_latest_snapshots", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  timeframe: text("timeframe").notNull(),
  calculatedAt: timestamp("calculated_at", {
    withTimezone: true,
  }).notNull(),
  movingAverages: jsonb("moving_averages")
    .$type<IndicatorSnapshot["movingAverages"]>()
    .notNull(),
  oscillators: jsonb("oscillators")
    .$type<IndicatorSnapshot["oscillators"]>()
    .notNull(),
  volatility: jsonb("volatility")
    .$type<IndicatorSnapshot["volatility"]>()
    .notNull(),
  volume: jsonb("volume").$type<IndicatorSnapshot["volume"]>().notNull(),
  levels: jsonb("levels").$type<IndicatorSnapshot["levels"]>().notNull(),
  structure: text("structure").notNull(),
  metadata: jsonb("metadata").$type<IndicatorSnapshot["metadata"]>().notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const signalAggregationLatestSnapshots = pgTable(
  "signal_aggregation_latest_snapshots",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id").notNull(),
    timeframe: text("timeframe").notNull(),
    generatedAt: timestamp("generated_at", {
      withTimezone: true,
    }).notNull(),
    asset: jsonb("asset").$type<SignalAggregationSnapshot["asset"]>().notNull(),
    marketSnapshot: jsonb("market_snapshot")
      .$type<SignalAggregationSnapshot["marketSnapshot"]>()
      .notNull(),
    indicatorSnapshot: jsonb("indicator_snapshot")
      .$type<SignalAggregationSnapshot["indicatorSnapshot"]>()
      .notNull(),
    position: jsonb("position").$type<SignalAggregationSnapshot["position"]>(),
    signalStrengthScore: integer("signal_strength_score").notNull(),
    bias: text("bias").notNull(),
    regime: text("regime").notNull(),
    timeframeRelevance: text("timeframe_relevance").notNull(),
    riskFlags: jsonb("risk_flags")
      .$type<SignalAggregationSnapshot["riskFlags"]>()
      .notNull(),
    keyLevels: jsonb("key_levels")
      .$type<SignalAggregationSnapshot["keyLevels"]>()
      .notNull(),
    labels: jsonb("labels")
      .$type<SignalAggregationSnapshot["labels"]>()
      .notNull(),
    summary: text("summary").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    metadata: jsonb("metadata")
      .$type<SignalAggregationSnapshot["metadata"]>()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
);

export const assetAnalysisLatestSnapshots = pgTable(
  "asset_analysis_latest_snapshots",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id").notNull(),
    timeframe: text("timeframe").notNull(),
    generatedAt: timestamp("generated_at", {
      withTimezone: true,
    }).notNull(),
    asset: jsonb("asset").$type<LatestAssetAnalysis["asset"]>().notNull(),
    marketSnapshot: jsonb("market_snapshot")
      .$type<LatestAssetAnalysis["marketSnapshot"]>()
      .notNull(),
    indicatorSnapshot: jsonb("indicator_snapshot")
      .$type<LatestAssetAnalysis["indicatorSnapshot"]>()
      .notNull(),
    position: jsonb("position").$type<LatestAssetAnalysis["position"]>(),
    state: text("state").notNull(),
    suggestion: text("suggestion").notNull(),
    summary: text("summary").notNull(),
    decisionCard: jsonb("decision_card")
      .$type<LatestAssetAnalysis["decisionCard"]>()
      .notNull(),
    regime: text("regime").notNull(),
    bias: text("bias").notNull(),
    signalStrengthScore: integer("signal_strength_score").notNull(),
    aiConfidence: integer("ai_confidence").notNull(),
    originalAiConfidence: integer("original_ai_confidence"),
    concerns: jsonb("concerns")
      .$type<LatestAssetAnalysis["concerns"]>()
      .notNull(),
    suggestedPositionSize: text("suggested_position_size").notNull(),
    timeframeRelevance: text("timeframe_relevance").notNull(),
    riskFlags: jsonb("risk_flags")
      .$type<LatestAssetAnalysis["riskFlags"]>()
      .notNull(),
    keyLevels: jsonb("key_levels")
      .$type<LatestAssetAnalysis["keyLevels"]>()
      .notNull(),
    modelUsed: text("model_used").notNull(),
    promptVersion: text("prompt_version").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    aiLatencyMs: integer("ai_latency_ms").notNull(),
    costEstimateUsd: text("cost_estimate_usd").notNull(),
    triggeredBy: text("triggered_by").notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata")
      .$type<LatestAssetAnalysis["metadata"]>()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
);

export const schema = {
  assetAnalysisLatestSnapshots,
  indicatorLatestSnapshots,
  marketLatestSnapshots,
  signalAggregationLatestSnapshots,
  serviceHeartbeats,
};
