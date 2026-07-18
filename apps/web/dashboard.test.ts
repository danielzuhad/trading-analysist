import { defaultCryptoWatchlistAssets } from "@trading-analyst/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  fetchAlerts,
  fetchAssetOverview,
  fetchWatchlistOverview,
  resolveDashboardTimeframe,
} from "./dashboard";

const asset = defaultCryptoWatchlistAssets[0];

if (!asset) {
  throw new Error("Expected the seeded BTC asset to exist.");
}

describe("web dashboard data helpers", () => {
  it("falls back to 4H when the timeframe query is invalid", () => {
    expect(resolveDashboardTimeframe("1H")).toBe("1H");
    expect(resolveDashboardTimeframe("4H")).toBe("4H");
    expect(resolveDashboardTimeframe("15M")).toBe("4H");
    expect(resolveDashboardTimeframe(undefined)).toBe("4H");
  });

  it("loads the watchlist overview payload through fetch", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        timeframe: "1H",
        generatedAt: "2026-04-20T08:00:00.000Z",
        items: [
          {
            asset,
            timeframe: "1H",
            status: "ready",
            missingData: [],
            marketCapturedAt: "2026-04-20T08:00:00.000Z",
            analysisGeneratedAt: "2026-04-20T08:05:00.000Z",
            provider: "coingecko",
            lastPrice: 84250.5,
            priceChangePercent: 2.1,
            state: "ACTIONABLE",
            suggestion: "ENTRY_ON_CONFIRMATION",
            signalStrengthScore: 82,
            aiConfidence: 78,
            regime: "trend",
            bias: "bullish",
            riskLevel: "medium",
            summary:
              "Trend remains constructive, but confirmation is still required.",
            keyReasons: ["EMA alignment remains bullish."],
            concerns: ["Resistance remains close overhead."],
            nearestSupport: 83200,
            nearestResistance: 84880,
            invalidation: 82594.75,
          },
        ],
      }),
      ok: true,
      status: 200,
    }));

    await expect(
      fetchWatchlistOverview("http://localhost:3001", "1H", fetchMock),
    ).resolves.toMatchObject({
      data: {
        timeframe: "1H",
        items: [
          {
            asset: {
              id: asset.id,
            },
            status: "ready",
          },
        ],
      },
      status: "ready",
    });
  });

  it("surfaces 404 asset overview responses as not-found", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        error: "ASSET_NOT_FOUND",
      }),
      ok: false,
      status: 404,
    }));

    await expect(
      fetchAssetOverview("http://localhost:3001", asset.id, "4H", fetchMock),
    ).resolves.toMatchObject({
      data: null,
      status: "not-found",
    });
  });

  it("loads recent alerts through fetch with optional timeframe and asset filters", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        alerts: [
          {
            id: "alert-btc-1",
            userId: "system:default",
            assetId: asset.id,
            timeframe: "4H",
            dedupeKey: "btc-4h-watch-actionable",
            kind: "market",
            severity: "warning",
            status: "suggested",
            channels: ["dashboard"],
            title: "BTC moved into ACTIONABLE",
            message: "BTC is approaching a breakout confirmation zone.",
            summary: "BTC remains constructive with resistance nearby.",
            previousState: "WATCH",
            currentState: "ACTIONABLE",
            suggestion: "ENTRY_ON_CONFIRMATION",
            createdAt: "2026-04-20T08:05:00.000Z",
            isStale: false,
            metadata: {},
          },
        ],
        count: 1,
      }),
      ok: true,
      status: 200,
    }));

    await expect(
      fetchAlerts(
        "http://localhost:3001",
        {
          assetId: asset.id,
          limit: 4,
          timeframe: "4H",
        },
        fetchMock,
      ),
    ).resolves.toMatchObject({
      data: {
        count: 1,
        alerts: [
          {
            assetId: asset.id,
            title: "BTC moved into ACTIONABLE",
          },
        ],
      },
      status: "ready",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/alerts?limit=4&assetId=${encodeURIComponent(asset.id)}&timeframe=4H`,
      {
        cache: "no-store",
      },
    );
  });
});
