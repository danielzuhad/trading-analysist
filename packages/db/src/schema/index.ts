import type {
  MarketCandle,
  MarketSnapshot,
  OhlcvCandle,
} from "@trading-analyst/shared-types";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export const schema = {
  marketLatestSnapshots,
  serviceHeartbeats,
};
