import type { Asset } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import {
  BybitContextProvider,
  CryptoPanicContextProvider,
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
  it("marks context as partial when one provider is disabled", async () => {
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
          provider: "cryptopanic",
          fetchContext: async () => ({
            status: {
              provider: "cryptopanic",
              status: "disabled",
              detail: "Token missing",
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
    expect(context.missingProviders).toEqual(["cryptopanic"]);
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

  it("disables cryptopanic when no token is configured", async () => {
    const provider = new CryptoPanicContextProvider();

    const result = await provider.fetchContext({
      asset: cryptoAsset,
      timeframe: "4H",
    });

    expect(result).toMatchObject({
      status: {
        provider: "cryptopanic",
        status: "disabled",
      },
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
