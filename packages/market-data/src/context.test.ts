import type { Asset } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  BybitContextProvider,
  CoinGeckoContextProvider,
  FearAndGreedContextProvider,
  MarketContextService,
} from "./context.js";

const cryptoAsset: Asset = {
  assetClass: "crypto",
  baseCurrency: "BTC",
  displaySymbol: "BTC/USD",
  exchange: "global",
  id: "crypto:global:BTC-USD",
  instrumentType: "spot",
  isActive: true,
  market: "global",
  metadata: {},
  name: "Bitcoin",
  providerSymbol: "BTC/USD",
  quoteCurrency: "USD",
  symbol: "BTC",
};

describe("market context services", () => {
  it("marks context as partial when one provider is down", async () => {
    const service = new MarketContextService({
      providers: [
        {
          provider: "fear-and-greed",
          fetchContext: async () => ({
            patch: {
              sentiment: {
                classification: "Fear",
                value: 32,
              },
            },
            status: {
              provider: "fear-and-greed",
              status: "active",
              metadata: {},
            },
          }),
        },
        {
          provider: "bybit",
          fetchContext: async () => ({
            status: {
              provider: "bybit",
              status: "down",
              detail: "Provider timeout",
              metadata: {},
            },
          }),
        },
      ],
    });

    const context = await service.fetchContext({
      asset: cryptoAsset,
      generatedAt: "2026-04-20T08:00:00.000Z",
      timeframe: "4H",
    });

    expect(context.isPartial).toBe(true);
    expect(context.missingProviders).toEqual(["bybit"]);
    expect(context.sentiment?.value).toBe(32);
  });

  it("parses the latest fear and greed snapshot", async () => {
    const provider = new FearAndGreedContextProvider({
      fetchFn: async () =>
        jsonResponse({
          data: [
            {
              timestamp: "1713596400",
              value: "40",
              value_classification: "Fear",
            },
          ],
        }),
    });

    const result = await provider.fetchContext({
      asset: cryptoAsset,
      timeframe: "4H",
    });

    expect(result.status.status).toBe("active");
    expect(result.patch?.sentiment).toMatchObject({
      classification: "Fear",
      value: 40,
    });
  });

  it("parses bybit funding and open interest context", async () => {
    const provider = new BybitContextProvider({
      fetchFn: async (input) => {
        const url = new URL(String(input));

        if (url.pathname === "/v5/market/funding/history") {
          return jsonResponse({
            retCode: 0,
            retMsg: "OK",
            result: {
              list: [
                {
                  symbol: "BTCUSDT",
                  fundingRate: "0.0001",
                  fundingRateTimestamp: "1713596400000",
                },
              ],
            },
          });
        }

        return jsonResponse({
          retCode: 0,
          retMsg: "OK",
          result: {
            list: [
              {
                openInterest: "12000",
                timestamp: "1713596400000",
              },
              {
                openInterest: "10000",
                timestamp: "1713582000000",
              },
            ],
          },
        });
      },
    });

    const result = await provider.fetchContext({
      asset: cryptoAsset,
      timeframe: "4H",
    });

    expect(result.status.status).toBe("active");
    expect(result.patch?.derivatives).toMatchObject({
      fundingRate: 0.0001,
      openInterest: 12000,
      openInterestChangePercent: 20,
    });
  });

  it("parses CoinGecko global context from the api/v3 path", async () => {
    const provider = new CoinGeckoContextProvider({
      fetchFn: async (input) => {
        const url = new URL(String(input));

        expect(url.pathname).toBe("/api/v3/global");

        return jsonResponse({
          data: {
            market_cap_change_percentage_24h_usd: 1.42,
            market_cap_percentage: {
              btc: 58.1,
            },
            total_market_cap: {
              usd: 2_480_000_000_000,
            },
            total_volume: {
              usd: 98_000_000_000,
            },
          },
        });
      },
    });

    const result = await provider.fetchContext({
      asset: cryptoAsset,
      timeframe: "4H",
    });

    expect(result.status.status).toBe("active");
    expect(result.patch).toMatchObject({
      btcDominancePercent: 58.1,
      totalMarketCapUsd: 2_480_000_000_000,
      totalMarketCapChange24hPercent: 1.42,
      totalVolume24hUsd: 98_000_000_000,
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
