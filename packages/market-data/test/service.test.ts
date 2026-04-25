import type { Asset } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import { CoinGeckoMarketDataAdapter } from "../src/adapters/coingecko.js";
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
  it("normalizes CoinGecko hourly crypto candles into a snapshot and candle series", async () => {
    const service = new MarketFetchService({
      adapters: [
        new CoinGeckoMarketDataAdapter({
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

    const result = await service.fetchMarketData({
      asset: cryptoAsset,
      candleLimit: 250,
      timeframe: "1H",
    });

    expect(result.series.provider).toBe("coingecko");
    expect(result.series.candles).toHaveLength(2);
    expect(result.snapshot.candle.close).toBe(148.2);
    expect(result.snapshot.marketSession).toBe("continuous");
    expect(result.snapshot.metadata).toMatchObject({
      coinId: "solana",
      coingeckoApiPlan: "demo",
      hasApiKey: false,
      sourceTimeframe: "1H",
    });
  });

  it("uses the public CoinGecko host and demo API key header for demo keys", async () => {
    const requests: Array<{
      headers: unknown;
      url: URL;
    }> = [];
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

    await service.fetchMarketData({
      asset: cryptoAsset,
      candleLimit: 2,
      timeframe: "1H",
    });

    expect(requests.map((request) => request.url.origin)).toEqual([
      "https://api.coingecko.com",
      "https://api.coingecko.com",
    ]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-demo-api-key"),
      ),
    ).toEqual(["cg-demo-key", "cg-demo-key"]);
    expect(
      requests.map((request) =>
        readHeader(request.headers, "x-cg-pro-api-key"),
      ),
    ).toEqual([undefined, undefined]);
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

function readHeader(headers: unknown, name: string) {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const record = headers as Record<string, string | undefined>;

  return record[name] ?? record[name.toLowerCase()];
}
