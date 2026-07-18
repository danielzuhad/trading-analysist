import type { Asset } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  CoinGeckoMarketDataAdapter,
  fetchCoinGeckoCurrentPrice,
} from "../src/adapters/coingecko.js";
import {
  MarketDataConfigurationError,
  MarketDataValidationError,
} from "../src/errors.js";
import { MarketFetchService } from "../src/service.js";

const cryptoAsset: Asset = {
  assetClass: "crypto",
  baseCurrency: "SOL",
  displaySymbol: "SOL/USD",
  exchange: "global",
  id: "crypto:global:SOL-USD",
  instrumentType: "spot",
  isActive: true,
  market: "global",
  metadata: {
    coingeckoCoinId: "solana",
  },
  name: "Solana",
  providerSymbol: "SOL/USD",
  quoteCurrency: "USD",
  symbol: "SOL",
};

const cryptoAssetWithoutCoinId: Asset = {
  ...cryptoAsset,
  baseCurrency: "BTC",
  id: "crypto:global:BTC-USD",
  metadata: {},
  name: "Bitcoin",
  providerSymbol: "BTC/USD",
  symbol: "BTC",
};

const stockAsset: Asset = {
  assetClass: "stock",
  displaySymbol: "NVDA",
  exchange: "NASDAQ",
  id: "stock:nasdaq:NVDA",
  instrumentType: "common-stock",
  isActive: true,
  market: "us",
  metadata: {},
  name: "NVIDIA Corporation",
  quoteCurrency: "USD",
  symbol: "NVDA",
};

describe("MarketFetchService", () => {
  it("builds CoinGecko demo 1H candles from 90-day market chart data", async () => {
    const service = new MarketFetchService({
      adapters: [
        new CoinGeckoMarketDataAdapter({
          fetchFn: async (input) => {
            const url = new URL(String(input));

            if (url.pathname === "/api/v3/coins/solana/market_chart") {
              expect(url.searchParams.get("days")).toBe("90");
              expect(url.searchParams.has("interval")).toBe(false);

              return jsonResponse({
                prices: [
                  [1712025000000, 146.4],
                  [1712026800000, 148.2],
                  [1712028600000, 148.8],
                  [1712030400000, 149.6],
                ],
                total_volumes: [
                  [1712025000000, 1523400],
                  [1712026800000, 1823400],
                  [1712028600000, 1923400],
                  [1712030400000, 2023400],
                ],
              });
            }

            return jsonResponse({}, { status: 404 });
          },
        }),
      ],
    });

    const result = await service.fetchMarketData({
      asset: cryptoAsset,
      candleLimit: 4,
      timeframe: "1H",
    });

    expect(result.series.provider).toBe("coingecko");
    expect(result.series.candles).toHaveLength(4);
    expect(result.snapshot.candle.close).toBe(149.6);
    expect(result.snapshot.marketSession).toBe("continuous");
    expect(result.snapshot.metadata).toMatchObject({
      coinId: "solana",
      coingeckoApiPlan: "demo",
      hasApiKey: false,
      sourceKind: "market_chart",
      sourceTimeframe: "1H",
    });
  });

  it("uses market chart data with enough demo 4H candles for EMA200", async () => {
    const requests: Array<{
      headers: unknown;
      url: URL;
    }> = [];
    const marketChartPayload = buildHourlyMarketChartPayload(804);
    const service = new MarketFetchService({
      adapters: [
        new CoinGeckoMarketDataAdapter({
          apiKey: "cg-demo-key",
          apiPlan: "demo",
          fetchFn: async (input, init) => {
            const url = new URL(String(input));
            requests.push({
              headers: init?.headers,
              url,
            });

            if (url.pathname === "/api/v3/coins/solana/market_chart") {
              expect(url.searchParams.get("days")).toBe("90");
              expect(url.searchParams.has("interval")).toBe(false);

              return jsonResponse(marketChartPayload);
            }

            return jsonResponse({}, { status: 404 });
          },
        }),
      ],
    });

    const result = await service.fetchMarketData({
      asset: cryptoAsset,
      candleLimit: 250,
      timeframe: "4H",
    });

    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/api/v3/coins/solana/market_chart",
    ]);
    expect(requests.map((request) => request.url.origin)).toEqual([
      "https://api.coingecko.com",
    ]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-demo-api-key"),
      ),
    ).toEqual(["cg-demo-key"]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-pro-api-key"),
      ),
    ).toEqual([undefined]);

    expect(result.series.candles.length).toBeGreaterThanOrEqual(200);
    expect(result.series.metadata).toMatchObject({
      candleCount: 201,
      sourceKind: "market_chart",
      sourceTimeframe: "1H",
    });
  });

  it("uses the pro CoinGecko host and pro API key header for Basic keys", async () => {
    const requests: Array<{
      headers: unknown;
      url: URL;
    }> = [];
    const service = new MarketFetchService({
      adapters: [
        new CoinGeckoMarketDataAdapter({
          apiKey: "cg-basic-key",
          apiPlan: "basic",
          fetchFn: async (input, init) => {
            const url = new URL(String(input));
            requests.push({
              headers: init?.headers,
              url,
            });

            if (url.pathname === "/api/v3/coins/solana/ohlc") {
              expect(url.searchParams.get("days")).toBe("90");
              expect(url.searchParams.get("interval")).toBe("hourly");

              return jsonResponse([
                [1712023200000, 144.8, 146.7, 144.1, 146.4],
                [1712026800000, 146.4, 149.1, 145.9, 148.2],
              ]);
            }

            if (url.pathname === "/api/v3/coins/solana/market_chart") {
              return jsonResponse({
                prices: [
                  [1712023200000, 146.4],
                  [1712026800000, 148.2],
                ],
                total_volumes: [
                  [1712023200000, 1523400],
                  [1712026800000, 1823400],
                ],
              });
            }

            return jsonResponse({}, { status: 404 });
          },
        }),
      ],
    });

    await service.fetchMarketData({
      asset: cryptoAsset,
      candleLimit: 2,
      timeframe: "1H",
    });

    expect(requests.map((request) => request.url.origin)).toEqual([
      "https://pro-api.coingecko.com",
      "https://pro-api.coingecko.com",
    ]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-pro-api-key"),
      ),
    ).toEqual(["cg-basic-key", "cg-basic-key"]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-demo-api-key"),
      ),
    ).toEqual([undefined, undefined]);
  });

  it("aggregates hourly CoinGecko candles into complete 4H candles", async () => {
    const service = new MarketFetchService({
      adapters: [
        new CoinGeckoMarketDataAdapter({
          apiKey: "cg-basic-key",
          apiPlan: "basic",
          fetchFn: async (input) => {
            const url = new URL(String(input));

            if (url.pathname === "/api/v3/coins/bitcoin/ohlc") {
              return jsonResponse([
                [1712019600000, 84010, 84200, 83920, 84100],
                [1712023200000, 84100, 84340, 84020, 84250],
                [1712026800000, 84250, 84510, 84180, 84400],
                [1712030400000, 84400, 84880, 84310, 84610],
              ]);
            }

            if (url.pathname === "/api/v3/coins/bitcoin/market_chart") {
              return jsonResponse({
                prices: [
                  [1712019600000, 84100],
                  [1712023200000, 84250],
                  [1712026800000, 84400],
                  [1712030400000, 84610],
                ],
                total_volumes: [
                  [1712019600000, 2400],
                  [1712023200000, 2450],
                  [1712026800000, 2500],
                  [1712030400000, 2680],
                ],
              });
            }

            return jsonResponse({}, { status: 404 });
          },
        }),
      ],
    });

    const result = await service.fetchMarketData({
      asset: cryptoAssetWithoutCoinId,
      timeframe: "4H",
    });

    expect(result.series.provider).toBe("coingecko");
    expect(result.series.candles).toHaveLength(1);
    expect(result.series.candles[0]).toMatchObject({
      close: 84610,
      high: 84880,
      low: 83920,
      open: 84010,
      volume: 10030,
    });
    expect(result.series.metadata.coinId).toBe("bitcoin");
  });

  it("rejects stock assets when no stock provider is configured for the MVP", async () => {
    const service = new MarketFetchService({
      adapters: [new CoinGeckoMarketDataAdapter()],
    });

    await expect(
      service.fetchMarketData({
        asset: stockAsset,
        timeframe: "1H",
      }),
    ).rejects.toBeInstanceOf(MarketDataConfigurationError);
  });

  it("rejects incomplete 4H aggregation when CoinGecko only returns partial hourly history", async () => {
    const service = new MarketFetchService({
      adapters: [
        new CoinGeckoMarketDataAdapter({
          apiKey: "cg-basic-key",
          apiPlan: "basic",
          fetchFn: async (input) => {
            const url = new URL(String(input));

            if (url.pathname === "/api/v3/coins/solana/ohlc") {
              return jsonResponse([
                [1712023200000, 144.8, 146.7, 144.1, 146.4],
                [1712026800000, 146.4, 149.1, 145.9, 148.2],
              ]);
            }

            if (url.pathname === "/api/v3/coins/solana/market_chart") {
              return jsonResponse({
                prices: [
                  [1712023200000, 146.4],
                  [1712026800000, 148.2],
                ],
                total_volumes: [
                  [1712023200000, 1523400],
                  [1712026800000, 1823400],
                ],
              });
            }

            return jsonResponse({}, { status: 404 });
          },
        }),
      ],
    });

    await expect(
      service.fetchMarketData({
        asset: cryptoAsset,
        timeframe: "4H",
      }),
    ).rejects.toBeInstanceOf(MarketDataValidationError);
  });

  it("fetches a current CoinGecko price through the lightweight simple price endpoint", async () => {
    const requests: Array<{
      headers: unknown;
      url: URL;
    }> = [];

    const pricePoint = await fetchCoinGeckoCurrentPrice({
      apiKey: "cg-demo-key",
      apiPlan: "demo",
      asset: cryptoAssetWithoutCoinId,
      fetchFn: async (input, init) => {
        const url = new URL(String(input));
        requests.push({
          headers: init?.headers,
          url,
        });

        expect(url.pathname).toBe("/api/v3/simple/price");
        expect(url.searchParams.get("ids")).toBe("bitcoin");
        expect(url.searchParams.get("vs_currencies")).toBe("usd");
        expect(url.searchParams.get("include_last_updated_at")).toBe("true");

        return jsonResponse({
          bitcoin: {
            last_updated_at: 1_712_036_300,
            usd: 67_187.3358936566,
          },
        });
      },
    });

    expect(requests.map((request) => request.url.origin)).toEqual([
      "https://api.coingecko.com",
    ]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-demo-api-key"),
      ),
    ).toEqual(["cg-demo-key"]);
    expect(pricePoint).toEqual({
      price: 67_187.3358936566,
      timestamp: "2024-04-02T05:38:20.000Z",
    });
  });
});

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
      ...init,
    }),
  );
}

function buildHourlyMarketChartPayload(pointCount: number) {
  const startTimestamp = Date.parse("2026-01-01T01:00:00.000Z");

  return {
    prices: Array.from({ length: pointCount }, (_, index) => [
      startTimestamp + index * 60 * 60 * 1000,
      100 + index,
    ]),
    total_volumes: Array.from({ length: pointCount }, (_, index) => [
      startTimestamp + index * 60 * 60 * 1000,
      1_000 + index,
    ]),
  };
}

function readHeader(headers: unknown, name: string) {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const record = headers as Record<string, string | undefined>;

  return record[name] ?? record[name.toLowerCase()];
}
