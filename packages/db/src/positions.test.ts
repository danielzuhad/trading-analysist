import type { Position } from "@trading-analyst/shared-types";
import { createPositionInputSchema } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  buildPositionFromInput,
  parsePosition,
  serializePosition,
} from "./positions.js";

const positionFixture: Position = {
  id: "position-btc-open",
  userId: "system:default",
  assetId: "crypto:global:BTC-USD",
  direction: "long",
  status: "open",
  quoteCurrency: "USD",
  entryPrice: 84250.5,
  averageEntryPrice: 84250.5,
  quantity: 0.25,
  remainingQuantity: 0.25,
  notionalValue: 21062.625,
  stopLoss: 82450,
  takeProfitLevels: [
    {
      label: "first target",
      percentageToClose: 50,
      price: 86800,
    },
  ],
  thesis: "Breakout continuation after 4H confirmation.",
  openedAt: "2026-04-21T08:00:00.000Z",
  lastUpdatedAt: "2026-04-21T08:00:00.000Z",
  isBackfilled: false,
  metadata: {
    source: "dashboard",
  },
};

describe("position persistence", () => {
  it("builds a full position from create input defaults", () => {
    const position = buildPositionFromInput(
      createPositionInputSchema.parse({
        assetId: positionFixture.assetId,
        direction: "long",
        entryPrice: 84250.5,
        quantity: 0.25,
        userId: positionFixture.userId,
      }),
      "2026-04-21T08:00:00.000Z",
    );

    expect(position).toMatchObject({
      assetId: positionFixture.assetId,
      averageEntryPrice: 84250.5,
      isBackfilled: false,
      remainingQuantity: 0.25,
      status: "open",
      userId: positionFixture.userId,
    });
    expect(position.id).toMatch(/^position:/);
  });

  it("serializes and parses position records", () => {
    const serialized = serializePosition(positionFixture);
    const parsed = parsePosition({
      ...serialized,
      closedAt: serialized.closedAt ?? null,
      isBackfilled: serialized.isBackfilled ?? false,
      latestState: serialized.latestState ?? null,
      latestSuggestion: serialized.latestSuggestion ?? null,
      notes: serialized.notes ?? null,
      notionalValue: serialized.notionalValue ?? null,
      openedAt: new Date(positionFixture.openedAt),
      quoteCurrency: serialized.quoteCurrency ?? null,
      realizedPnl: serialized.realizedPnl ?? null,
      realizedPnlPercent: serialized.realizedPnlPercent ?? null,
      sourceAccount: serialized.sourceAccount ?? null,
      stopLoss: serialized.stopLoss ?? null,
      thesis: serialized.thesis ?? null,
      unrealizedPnl: serialized.unrealizedPnl ?? null,
      unrealizedPnlPercent: serialized.unrealizedPnlPercent ?? null,
      updatedAt: new Date(positionFixture.lastUpdatedAt),
      watchlistId: serialized.watchlistId ?? null,
    });

    expect(serialized.entryPrice).toBe("84250.5");
    expect(serialized.takeProfitLevels).toHaveLength(1);
    expect(parsed).toEqual(positionFixture);
  });
});
