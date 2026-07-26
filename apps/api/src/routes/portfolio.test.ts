import type { Position } from "@trading-analyst/shared-types";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerPortfolioRoutes } from "./portfolio.js";

function buildPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: overrides.id ?? "position:1",
    userId: "system:default",
    assetId: overrides.assetId ?? "crypto:global:BTC-USD",
    direction: overrides.direction ?? "long",
    status: "open",
    entryPrice: overrides.entryPrice ?? 100,
    averageEntryPrice: overrides.entryPrice ?? 100,
    quantity: overrides.quantity ?? 10,
    remainingQuantity: overrides.remainingQuantity ?? overrides.quantity ?? 10,
    takeProfitLevels: [],
    openedAt: "2026-07-01T00:00:00.000Z",
    lastUpdatedAt: "2026-07-01T00:00:00.000Z",
    isBackfilled: false,
    metadata: {},
    ...overrides,
  };
}

async function buildTestApp(positions: Position[]) {
  const listPositions = vi.fn().mockResolvedValue(positions);
  const app = Fastify();

  await registerPortfolioRoutes(app, {
    listPositions,
  });

  return { app, listPositions };
}

describe("portfolio routes", () => {
  it("returns an empty overview when there are no open positions", async () => {
    const { app } = await buildTestApp([]);

    const response = await app.inject({
      method: "GET",
      url: "/portfolio/overview",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.openPositionCount).toBe(0);
    expect(body.totalNotionalValue).toBe(0);
    expect(body.positions).toEqual([]);
    expect(body.concentrationWarnings).toEqual([]);
  });

  it("computes exposure and P&L across open positions", async () => {
    const { app } = await buildTestApp([
      buildPosition({
        id: "position:btc",
        assetId: "crypto:global:BTC-USD",
        direction: "long",
        entryPrice: 100,
        quantity: 10,
        unrealizedPnl: 50,
      }),
      buildPosition({
        id: "position:eth",
        assetId: "crypto:global:ETH-USD",
        direction: "short",
        entryPrice: 50,
        quantity: 20,
        unrealizedPnl: -25,
      }),
      buildPosition({
        id: "position:sol",
        assetId: "crypto:global:SOL-USD",
        direction: "short",
        entryPrice: 50,
        quantity: 20,
        unrealizedPnl: 5,
      }),
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/portfolio/overview",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.openPositionCount).toBe(3);
    expect(body.totalNotionalValue).toBe(3000);
    expect(body.totalUnrealizedPnl).toBe(30);
    expect(body.longExposurePercent).toBeCloseTo(33.33, 1);
    expect(body.shortExposurePercent).toBeCloseTo(66.67, 1);
    expect(body.positions).toHaveLength(3);
    expect(body.concentrationWarnings).toEqual([]);
  });

  it("flags direction concentration when exposure is one-sided", async () => {
    const { app } = await buildTestApp([
      buildPosition({
        id: "position:btc",
        assetId: "crypto:global:BTC-USD",
        direction: "long",
        entryPrice: 100,
        quantity: 10,
      }),
      buildPosition({
        id: "position:eth",
        assetId: "crypto:global:ETH-USD",
        direction: "long",
        entryPrice: 100,
        quantity: 10,
      }),
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/portfolio/overview",
    });

    const body = response.json();
    expect(body.longExposurePercent).toBe(100);
    expect(
      body.concentrationWarnings.some(
        (warning: { kind: string }) =>
          warning.kind === "direction_concentration",
      ),
    ).toBe(true);
  });

  it("flags single asset concentration above the threshold", async () => {
    const { app } = await buildTestApp([
      buildPosition({
        id: "position:btc",
        assetId: "crypto:global:BTC-USD",
        direction: "long",
        entryPrice: 100,
        quantity: 90,
      }),
      buildPosition({
        id: "position:eth",
        assetId: "crypto:global:ETH-USD",
        direction: "short",
        entryPrice: 100,
        quantity: 10,
      }),
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/portfolio/overview",
    });

    const body = response.json();
    expect(
      body.concentrationWarnings.some(
        (warning: { kind: string }) =>
          warning.kind === "single_asset_concentration",
      ),
    ).toBe(true);
  });
});
