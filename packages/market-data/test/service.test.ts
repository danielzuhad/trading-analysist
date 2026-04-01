import type { Asset } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import { TwelveDataMarketDataAdapter } from "../src/adapters/twelve-data.js";
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
  metadata: {},
  name: "Solana",
  providerSymbol: "SOL/USD",
  quoteCurrency: "USD",
  symbol: "SOL",
};

const cryptoAssetWithoutProviderSymbol: Asset = {
  ...cryptoAsset,
  id: "crypto:global:BTC-USD",
  baseCurrency: "BTC",
  displaySymbol: "BTC/USD",
  name: "Bitcoin",
  providerSymbol: undefined,
  quoteCurrency: "USD",
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
  it("normalizes Twelve Data crypto candles into a snapshot and candle series", async () => {
    const service = new MarketFetchService({
      adapters: [
        new TwelveDataMarketDataAdapter({
          apiKey: "test-key",
          fetchFn: async (input) => {
            const url = new URL(String(input));

            if (url.pathname === "/time_series") {
              return jsonResponse({
                meta: {
                  currency: "USD",
                  exchange: "CRYPTO",
                  exchange_timezone: "UTC",
                  interval: "1h",
                  symbol: "SOL/USD",
                },
                values: [
                  {
                    close: "146.40",
                    datetime: "2026-03-31 08:00:00",
                    high: "146.70",
                    low: "144.10",
                    open: "144.80",
                    volume: "1523400",
                  },
                  {
                    close: "148.20",
                    datetime: "2026-03-31 09:00:00",
                    high: "149.10",
                    low: "145.90",
                    open: "146.40",
                    volume: "1823400",
                  },
                ],
              });
            }

            if (url.pathname === "/quote") {
              return jsonResponse({
                close: "148.20",
                datetime: "2026-03-31 09:15:00",
                is_market_open: "true",
                percent_change: "2.10",
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

    expect(result.series.provider).toBe("twelve-data");
    expect(result.series.candles).toHaveLength(2);
    expect(result.snapshot.candle.close).toBe(148.2);
    expect(result.snapshot.marketSession).toBe("continuous");
    expect(result.snapshot.metadata.isStale).toBeTypeOf("boolean");
  });

  it("falls back to a base and quote pair when the asset has no provider symbol", async () => {
    const requestedSymbols: string[] = [];
    const service = new MarketFetchService({
      adapters: [
        new TwelveDataMarketDataAdapter({
          apiKey: "test-key",
          fetchFn: async (input) => {
            const url = new URL(String(input));
            const symbol = url.searchParams.get("symbol");

            if (symbol) {
              requestedSymbols.push(symbol);
            }

            if (url.pathname === "/time_series") {
              return jsonResponse({
                meta: {
                  currency: "USD",
                  exchange: "CRYPTO",
                  exchange_timezone: "UTC",
                  interval: "4h",
                  symbol,
                },
                values: [
                  {
                    close: "84250",
                    datetime: "2026-03-31 08:00:00",
                    high: "84520",
                    low: "83810",
                    open: "84010",
                    volume: "2450",
                  },
                  {
                    close: "84610",
                    datetime: "2026-03-31 12:00:00",
                    high: "84880",
                    low: "84100",
                    open: "84250",
                    volume: "2680",
                  },
                ],
              });
            }

            if (url.pathname === "/quote") {
              return jsonResponse({
                close: "84610",
                datetime: "2026-03-31 12:15:00",
                is_market_open: "true",
                percent_change: "0.91",
              });
            }

            return jsonResponse({}, { status: 404 });
          },
        }),
      ],
    });

    const result = await service.fetchMarketData({
      asset: cryptoAssetWithoutProviderSymbol,
      timeframe: "4H",
    });

    expect(requestedSymbols).toEqual(["BTC/USD", "BTC/USD"]);
    expect(result.series.provider).toBe("twelve-data");
    expect(result.series.quoteCurrency).toBe("USD");
  });

  it("throws a configuration error when Twelve Data is used without an API key", async () => {
    const service = new MarketFetchService({
      adapters: [new TwelveDataMarketDataAdapter()],
    });

    await expect(
      service.fetchMarketData({
        asset: cryptoAsset,
        timeframe: "1H",
      }),
    ).rejects.toBeInstanceOf(MarketDataConfigurationError);
  });

  it("rejects stock assets while the repo is aligned to the crypto MVP", async () => {
    const service = new MarketFetchService({
      adapters: [new TwelveDataMarketDataAdapter({ apiKey: "test-key" })],
    });

    await expect(
      service.fetchMarketData({
        asset: stockAsset,
        timeframe: "1H",
      }),
    ).rejects.toBeInstanceOf(MarketDataConfigurationError);
  });

  it("rejects empty provider candle payloads", async () => {
    const service = new MarketFetchService({
      adapters: [
        new TwelveDataMarketDataAdapter({
          apiKey: "test-key",
          fetchFn: async (input) => {
            const url = new URL(String(input));

            if (url.pathname === "/time_series") {
              return jsonResponse({
                meta: {
                  exchange_timezone: "UTC",
                  interval: "1h",
                  symbol: "SOL/USD",
                },
                values: [],
              });
            }

            return jsonResponse({
              close: "148.20",
              is_market_open: true,
            });
          },
        }),
      ],
    });

    await expect(
      service.fetchMarketData({
        asset: cryptoAsset,
        timeframe: "1H",
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
