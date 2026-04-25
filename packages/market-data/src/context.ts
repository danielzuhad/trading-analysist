import {
  type Asset,
  type MarketContextProvider,
  type MarketContextProviderStatus,
  type MarketContextSnapshot,
  marketContextSnapshotSchema,
} from "@trading-analyst/shared-types";
import { z } from "zod";
import {
  buildCoinGeckoAuthHeaders,
  type CoinGeckoApiPlan,
  resolveCoinGeckoApiPlan,
  resolveCoinGeckoBaseUrl,
} from "./coingecko-auth.js";
import { type FetchLike, fetchJson } from "./http.js";

type MarketContextRequest = {
  asset: Asset;
  generatedAt?: string;
  timeframe: "1H" | "4H";
};

type MarketContextProviderPatch = Pick<
  MarketContextSnapshot,
  | "btcDominancePercent"
  | "derivatives"
  | "news"
  | "sentiment"
  | "totalMarketCapChange24hPercent"
  | "totalMarketCapUsd"
  | "totalVolume24hUsd"
>;

export type MarketContextProviderResult = {
  patch?: MarketContextProviderPatch;
  status: Omit<MarketContextProviderStatus, "checkedAt" | "latencyMs">;
};

export type MarketContextProviderAdapter = {
  readonly provider: MarketContextProvider;
  fetchContext: (
    request: MarketContextRequest,
  ) => Promise<MarketContextProviderResult>;
};

type CoinGeckoContextProviderOptions = {
  apiKey?: string;
  apiPlan?: CoinGeckoApiPlan;
  baseUrl?: string;
  fetchFn?: FetchLike;
  requestTimeoutMs?: number;
};

type FearAndGreedContextProviderOptions = {
  baseUrl?: string;
  fetchFn?: FetchLike;
  requestTimeoutMs?: number;
};

type BybitContextProviderOptions = {
  baseUrl?: string;
  fetchFn?: FetchLike;
  requestTimeoutMs?: number;
};

type MarketContextServiceOptions = {
  providers: MarketContextProviderAdapter[];
};

const defaultBybitBaseUrl = "https://api.bybit.com";
const defaultFearAndGreedBaseUrl = "https://api.alternative.me";

const numberishSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().finite());

const unixTimestampSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().int().nonnegative());

const coinGeckoGlobalSchema = z.object({
  data: z.object({
    market_cap_change_percentage_24h_usd: z.number().finite().optional(),
    market_cap_percentage: z.object({
      btc: z.number().finite().optional(),
    }),
    total_market_cap: z.object({
      usd: z.number().finite().optional(),
    }),
    total_volume: z.object({
      usd: z.number().finite().optional(),
    }),
    volume_change_percentage_24h_usd: z.number().finite().optional(),
  }),
});

const fearAndGreedSchema = z.object({
  data: z
    .array(
      z.object({
        timestamp: unixTimestampSchema,
        value: numberishSchema.pipe(z.number().int().min(0).max(100)),
        value_classification: z.string(),
        value_text: z.string().optional(),
      }),
    )
    .min(1),
});

const bybitFundingHistorySchema = z.object({
  retCode: z.number().int(),
  retMsg: z.string(),
  result: z.object({
    list: z.array(
      z.object({
        fundingRate: numberishSchema,
        fundingRateTimestamp: unixTimestampSchema,
        symbol: z.string(),
      }),
    ),
  }),
});

const bybitOpenInterestSchema = z.object({
  retCode: z.number().int(),
  retMsg: z.string(),
  result: z.object({
    list: z.array(
      z.object({
        openInterest: numberishSchema,
        timestamp: unixTimestampSchema,
      }),
    ),
  }),
});

export class MarketContextService {
  private readonly providers: MarketContextProviderAdapter[];

  constructor(options: MarketContextServiceOptions) {
    this.providers = [...options.providers];
  }

  async fetchContext({
    asset,
    generatedAt = new Date().toISOString(),
    timeframe,
  }: MarketContextRequest): Promise<MarketContextSnapshot> {
    const providerResults = await Promise.all(
      this.providers.map(async (provider) =>
        this.fetchProvider(provider, {
          asset,
          generatedAt,
          timeframe,
        }),
      ),
    );

    const patches = providerResults.flatMap((result) =>
      result.patch ? [result.patch] : [],
    );
    const providers = providerResults.map((result) => result.status);
    const missingProviders = providers
      .filter((provider) => provider.status !== "active")
      .map((provider) => provider.provider);

    return marketContextSnapshotSchema.parse({
      id: `context:${asset.id}:${timeframe}:${generatedAt}`,
      assetId: asset.id,
      timeframe,
      generatedAt,
      isPartial: missingProviders.length > 0,
      missingProviders,
      providers,
      ...Object.assign({}, ...patches),
      metadata: {
        providerCount: providers.length,
      },
    });
  }

  private async fetchProvider(
    provider: MarketContextProviderAdapter,
    request: MarketContextRequest & {
      generatedAt: string;
    },
  ): Promise<{
    patch?: MarketContextProviderPatch;
    status: MarketContextProviderStatus;
  }> {
    const startedAt = Date.now();

    try {
      const result = await provider.fetchContext(request);

      const status = {
        ...result.status,
        checkedAt: request.generatedAt,
        latencyMs: Date.now() - startedAt,
      } satisfies MarketContextProviderStatus;

      return result.patch
        ? {
            patch: result.patch,
            status,
          }
        : {
            status,
          };
    } catch (error) {
      return {
        status: {
          provider: provider.provider,
          status: "down",
          checkedAt: request.generatedAt,
          latencyMs: Date.now() - startedAt,
          detail: error instanceof Error ? error.message : "Unknown error",
          metadata: {},
        },
      };
    }
  }
}

export class CoinGeckoContextProvider implements MarketContextProviderAdapter {
  readonly provider = "coingecko" as const;

  private readonly apiKey: string | undefined;
  private readonly apiPlan: CoinGeckoApiPlan;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike | undefined;
  private readonly requestTimeoutMs: number | undefined;

  constructor(options: CoinGeckoContextProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.apiPlan = resolveCoinGeckoApiPlan(options.apiPlan);
    this.baseUrl = resolveCoinGeckoBaseUrl({
      apiKey: options.apiKey,
      apiPlan: this.apiPlan,
      baseUrl: options.baseUrl,
    });
    this.fetchFn = options.fetchFn;
    this.requestTimeoutMs = options.requestTimeoutMs;
  }

  async fetchContext(
    _request: MarketContextRequest,
  ): Promise<MarketContextProviderResult> {
    const url = buildUrl(this.baseUrl, "/global", {});
    const payload = coinGeckoGlobalSchema.parse(
      await fetchJson(url, this.buildRequestOptions()),
    );

    return {
      patch: {
        btcDominancePercent: payload.data.market_cap_percentage.btc,
        totalMarketCapUsd: payload.data.total_market_cap.usd,
        totalMarketCapChange24hPercent:
          payload.data.market_cap_change_percentage_24h_usd,
        totalVolume24hUsd: payload.data.total_volume.usd,
      },
      status: {
        provider: this.provider,
        status: "active",
        metadata: {
          apiPlan: this.apiPlan,
          hasApiKey: Boolean(this.apiKey),
        },
      },
    };
  }

  private buildRequestOptions() {
    const headers = buildCoinGeckoAuthHeaders({
      apiKey: this.apiKey,
      apiPlan: this.apiPlan,
    });

    return {
      ...(this.fetchFn ? { fetchFn: this.fetchFn } : {}),
      ...(headers ? { headers } : {}),
      provider: this.provider,
      ...(this.requestTimeoutMs !== undefined
        ? { timeoutMs: this.requestTimeoutMs }
        : {}),
    };
  }
}

export class FearAndGreedContextProvider
  implements MarketContextProviderAdapter
{
  readonly provider = "fear-and-greed" as const;

  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike | undefined;
  private readonly requestTimeoutMs: number | undefined;

  constructor(options: FearAndGreedContextProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultFearAndGreedBaseUrl;
    this.fetchFn = options.fetchFn;
    this.requestTimeoutMs = options.requestTimeoutMs;
  }

  async fetchContext(
    _request: MarketContextRequest,
  ): Promise<MarketContextProviderResult> {
    const url = new URL("/fng/", ensureTrailingSlash(this.baseUrl));
    url.searchParams.set("limit", "1");

    const payload = fearAndGreedSchema.parse(
      await fetchJson(url, this.buildRequestOptions()),
    );
    const latest = payload.data[0];

    if (!latest) {
      throw new Error("Fear & Greed provider returned no data.");
    }

    return {
      patch: {
        sentiment: {
          classification: latest.value_classification,
          value: latest.value,
          ...(latest.value_text ? { valueText: latest.value_text } : {}),
        },
      },
      status: {
        provider: this.provider,
        status: "active",
        metadata: {},
      },
    };
  }

  private buildRequestOptions() {
    return {
      ...(this.fetchFn ? { fetchFn: this.fetchFn } : {}),
      provider: this.provider,
      ...(this.requestTimeoutMs !== undefined
        ? { timeoutMs: this.requestTimeoutMs }
        : {}),
    };
  }
}

export class BybitContextProvider implements MarketContextProviderAdapter {
  readonly provider = "bybit" as const;

  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike | undefined;
  private readonly requestTimeoutMs: number | undefined;

  constructor(options: BybitContextProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultBybitBaseUrl;
    this.fetchFn = options.fetchFn;
    this.requestTimeoutMs = options.requestTimeoutMs;
  }

  async fetchContext(
    request: MarketContextRequest,
  ): Promise<MarketContextProviderResult> {
    const symbol = resolveBybitSymbol(request.asset);
    const intervalTime = request.timeframe === "1H" ? "1h" : "4h";
    const [fundingPayload, openInterestPayload] = await Promise.all([
      fetchJson(
        buildUrl(this.baseUrl, "/v5/market/funding/history", {
          category: "linear",
          limit: "1",
          symbol,
        }),
        this.buildRequestOptions(),
      ),
      fetchJson(
        buildUrl(this.baseUrl, "/v5/market/open-interest", {
          category: "linear",
          intervalTime,
          limit: "2",
          symbol,
        }),
        this.buildRequestOptions(),
      ),
    ]);

    const funding = bybitFundingHistorySchema.parse(fundingPayload);
    const openInterest = bybitOpenInterestSchema.parse(openInterestPayload);

    if (funding.retCode !== 0) {
      throw new Error(`Bybit funding request failed: ${funding.retMsg}`);
    }

    if (openInterest.retCode !== 0) {
      throw new Error(
        `Bybit open interest request failed: ${openInterest.retMsg}`,
      );
    }

    const latestFunding = funding.result.list[0];
    const latestOpenInterest = openInterest.result.list[0];
    const previousOpenInterest = openInterest.result.list[1];

    return {
      patch: {
        derivatives: {
          ...(latestFunding
            ? {
                fundingRate: latestFunding.fundingRate,
                fundingRateTimestamp: new Date(
                  latestFunding.fundingRateTimestamp,
                ).toISOString(),
              }
            : {}),
          ...(latestOpenInterest
            ? {
                openInterest: latestOpenInterest.openInterest,
                openInterestTimestamp: new Date(
                  latestOpenInterest.timestamp,
                ).toISOString(),
              }
            : {}),
          ...(latestOpenInterest && previousOpenInterest
            ? {
                openInterestChangePercent: calculateChangePercent(
                  latestOpenInterest.openInterest,
                  previousOpenInterest.openInterest,
                ),
              }
            : {}),
        },
      },
      status: {
        provider: this.provider,
        status: "active",
        metadata: {
          symbol,
        },
      },
    };
  }

  private buildRequestOptions() {
    return {
      ...(this.fetchFn ? { fetchFn: this.fetchFn } : {}),
      provider: this.provider,
      ...(this.requestTimeoutMs !== undefined
        ? { timeoutMs: this.requestTimeoutMs }
        : {}),
    };
  }
}

function buildUrl(
  baseUrl: string,
  pathname: string,
  query: Record<string, string>,
) {
  const normalizedPath = pathname.startsWith("/")
    ? pathname.slice(1)
    : pathname;
  const url = new URL(normalizedPath, ensureTrailingSlash(baseUrl));

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function calculateChangePercent(current: number, previous: number) {
  if (previous === 0) {
    return 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(4));
}

function resolveBybitSymbol(asset: Asset) {
  if (asset.baseCurrency) {
    return `${asset.baseCurrency}USDT`;
  }

  return asset.symbol.endsWith("USDT") ? asset.symbol : `${asset.symbol}USDT`;
}
