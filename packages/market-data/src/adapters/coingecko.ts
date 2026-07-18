import {
  type Asset,
  type MarketCandleSeries,
  type MarketPricePoint,
  marketCandleSeriesSchema,
} from "@trading-analyst/shared-types";
import { z } from "zod";
import {
  buildCoinGeckoAuthHeaders,
  type CoinGeckoApiPlan,
  resolveCoinGeckoApiPlan,
  resolveCoinGeckoBaseUrl,
} from "../coingecko-auth.js";
import { MarketDataValidationError } from "../errors.js";
import { buildFreshnessMetadata, type FetchLike, fetchJson } from "../http.js";
import type {
  MarketDataAdapter,
  ValidatedMarketDataRequest,
} from "../types.js";

const providerName = "coingecko";
const quoteCurrency = "USD";
const fourHoursMs = 4 * 60 * 60 * 1000;

const numericSchema = z.number().finite().nonnegative();
const timestampSchema = z.number().int().nonnegative();

const ohlcPayloadSchema = z
  .array(
    z.tuple([
      timestampSchema,
      numericSchema,
      numericSchema,
      numericSchema,
      numericSchema,
    ]),
  )
  .min(1);

const marketChartPayloadSchema = z.object({
  prices: z.array(z.tuple([timestampSchema, z.number().finite()])).min(1),
  total_volumes: z.array(z.tuple([timestampSchema, numericSchema])).min(1),
});
const simplePriceCoinSchema = z.object({
  usd: z.number().finite().positive(),
  last_updated_at: timestampSchema.optional(),
});

type CoinGeckoMarketDataAdapterOptions = {
  apiKey?: string;
  apiPlan?: CoinGeckoApiPlan;
  baseUrl?: string;
  fetchFn?: FetchLike;
  requestTimeoutMs?: number;
};

type CandlePoint = {
  close: number;
  high: number;
  low: number;
  open: number;
  timestamp: string;
  volume: number;
};

type CoinGeckoSourceKind = "market_chart" | "ohlc";
type CoinGeckoSourceTimeframe = "1H";

type CoinGeckoSeriesRequestConfig = {
  days: "90";
  marketChartInterval?: "hourly";
  ohlcInterval?: "hourly";
  sourceKind: CoinGeckoSourceKind;
  sourceTimeframe: CoinGeckoSourceTimeframe;
};

export class CoinGeckoMarketDataAdapter implements MarketDataAdapter {
  readonly provider = providerName;

  private readonly apiKey: string | undefined;
  private readonly apiPlan: CoinGeckoApiPlan;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike | undefined;
  private readonly requestTimeoutMs: number | undefined;

  constructor(options: CoinGeckoMarketDataAdapterOptions = {}) {
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

  async fetchSeries(
    request: ValidatedMarketDataRequest,
  ): Promise<MarketCandleSeries> {
    if (request.asset.assetClass !== "crypto") {
      throw new MarketDataValidationError(
        this.provider,
        "CoinGecko market data adapter only supports crypto assets in the current MVP",
        {
          assetClass: request.asset.assetClass,
          assetId: request.asset.id,
        },
      );
    }

    const coinId = resolveCoinGeckoCoinId(request.asset);
    const requestConfig = resolveCoinGeckoSeriesRequestConfig(
      request.timeframe,
      this.apiPlan,
    );
    const [rawMarketChart, rawOhlc] = await Promise.all([
      fetchJson(
        buildCoinGeckoUrl(
          this.baseUrl,
          `/coins/${coinId}/market_chart`,
          buildCoinGeckoQuery(requestConfig, "market_chart"),
        ),
        this.buildRequestOptions(),
      ),
      requestConfig.sourceKind === "ohlc"
        ? fetchJson(
            buildCoinGeckoUrl(
              this.baseUrl,
              `/coins/${coinId}/ohlc`,
              buildCoinGeckoQuery(requestConfig, "ohlc"),
            ),
            this.buildRequestOptions(),
          )
        : Promise.resolve(undefined),
    ]);

    const marketChart = marketChartPayloadSchema.parse(rawMarketChart);
    const sourceCandles =
      requestConfig.sourceKind === "ohlc"
        ? buildOhlcCandles(ohlcPayloadSchema.parse(rawOhlc), marketChart)
        : buildMarketChartCandles(marketChart);
    const candles = normalizeCandles(
      sourceCandles,
      requestConfig.sourceTimeframe,
      request.timeframe,
    );
    const latestCandle = candles.at(-1);

    if (!latestCandle) {
      throw new MarketDataValidationError(
        this.provider,
        `CoinGecko returned no complete ${request.timeframe} candles`,
        {
          assetId: request.asset.id,
          coinId,
          timeframe: request.timeframe,
        },
      );
    }

    const previousCandle = candles.at(-2);
    const fetchedAt = new Date().toISOString();

    return marketCandleSeriesSchema.parse({
      assetId: request.asset.id,
      baseCurrency: request.asset.baseCurrency,
      candles: candles.slice(-request.candleLimit),
      capturedAt: latestCandle.timestamp,
      eventFlags: [],
      lastPrice: latestCandle.close,
      marketSession: "continuous",
      metadata: {
        ...buildFreshnessMetadata(
          request.timeframe,
          latestCandle.timestamp,
          fetchedAt,
        ),
        candleCount: candles.length,
        coinId,
        coingeckoApiPlan: this.apiPlan,
        hasApiKey: Boolean(this.apiKey),
        providerSymbol:
          request.asset.providerSymbol ?? request.asset.displaySymbol,
        sourceKind: requestConfig.sourceKind,
        sourceTimeframe: requestConfig.sourceTimeframe,
      },
      ...(previousCandle
        ? {
            priceChangePercent: calculateChangePercent(
              latestCandle.close,
              previousCandle.close,
            ),
          }
        : {}),
      provider: this.provider,
      quoteCurrency,
      timeframe: request.timeframe,
    });
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

export async function fetchCoinGeckoCurrentPrice({
  apiKey,
  apiPlan,
  asset,
  baseUrl,
  fetchFn,
  requestTimeoutMs,
}: CoinGeckoMarketDataAdapterOptions & {
  asset: Asset;
}): Promise<MarketPricePoint> {
  if (asset.assetClass !== "crypto") {
    throw new MarketDataValidationError(
      providerName,
      "CoinGecko current price fetch only supports crypto assets in the current MVP",
      {
        assetClass: asset.assetClass,
        assetId: asset.id,
      },
    );
  }

  const coinId = resolveCoinGeckoCoinId(asset);
  const normalizedApiPlan = resolveCoinGeckoApiPlan(apiPlan);
  const resolvedBaseUrl = resolveCoinGeckoBaseUrl({
    apiKey,
    apiPlan: normalizedApiPlan,
    baseUrl,
  });
  const headers = buildCoinGeckoAuthHeaders({
    apiKey,
    apiPlan: normalizedApiPlan,
  });
  const payload = z.record(z.string(), simplePriceCoinSchema).parse(
    await fetchJson(
      buildCoinGeckoUrl(resolvedBaseUrl, "/simple/price", {
        ids: coinId,
        include_last_updated_at: "true",
        precision: "full",
        vs_currencies: quoteCurrency.toLowerCase(),
      }),
      {
        ...(fetchFn ? { fetchFn } : {}),
        ...(headers ? { headers } : {}),
        provider: providerName,
        ...(requestTimeoutMs !== undefined
          ? { timeoutMs: requestTimeoutMs }
          : {}),
      },
    ),
  );
  const coinPayload = payload[coinId];

  if (!coinPayload) {
    throw new MarketDataValidationError(
      providerName,
      "CoinGecko current price response did not include the requested asset",
      {
        assetId: asset.id,
        coinId,
      },
    );
  }

  return {
    price: coinPayload.usd,
    timestamp: coinPayload.last_updated_at
      ? new Date(coinPayload.last_updated_at * 1000).toISOString()
      : new Date().toISOString(),
  };
}

function buildCoinGeckoQuery(
  requestConfig: CoinGeckoSeriesRequestConfig,
  endpoint: "market_chart" | "ohlc",
): Record<string, string> {
  const interval =
    endpoint === "ohlc"
      ? requestConfig.ohlcInterval
      : requestConfig.marketChartInterval;

  return {
    days: requestConfig.days,
    ...(interval ? { interval } : {}),
    vs_currency: quoteCurrency.toLowerCase(),
  };
}

function resolveCoinGeckoSeriesRequestConfig(
  _timeframe: ValidatedMarketDataRequest["timeframe"],
  apiPlan: CoinGeckoApiPlan,
): CoinGeckoSeriesRequestConfig {
  if (apiPlan === "basic") {
    return {
      days: "90",
      marketChartInterval: "hourly",
      ohlcInterval: "hourly",
      sourceKind: "ohlc",
      sourceTimeframe: "1H",
    };
  }

  return {
    days: "90",
    sourceKind: "market_chart",
    sourceTimeframe: "1H",
  };
}

function buildOhlcCandles(
  ohlcPayload: z.infer<typeof ohlcPayloadSchema>,
  marketChartPayload: z.infer<typeof marketChartPayloadSchema>,
) {
  const volumePoints = [...marketChartPayload.total_volumes].sort(
    (left, right) => left[0] - right[0],
  );

  return [...ohlcPayload]
    .sort((left, right) => left[0] - right[0])
    .map(([timestamp, open, high, low, close]) => ({
      close,
      high,
      low,
      open,
      timestamp: new Date(timestamp).toISOString(),
      volume: resolveNearestVolume(timestamp, volumePoints),
    }));
}

function buildMarketChartCandles(
  marketChartPayload: z.infer<typeof marketChartPayloadSchema>,
) {
  const volumePoints = [...marketChartPayload.total_volumes].sort(
    (left, right) => left[0] - right[0],
  );
  const pricePoints = [...marketChartPayload.prices].sort(
    (left, right) => left[0] - right[0],
  );

  return pricePoints.map(([timestamp, close], index) => {
    const previousPrice = pricePoints[index - 1]?.[1];
    const open = previousPrice ?? close;

    return {
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
      open,
      timestamp: new Date(timestamp).toISOString(),
      volume: resolveNearestVolume(timestamp, volumePoints),
    };
  });
}

function normalizeCandles(
  candles: CandlePoint[],
  sourceTimeframe: CoinGeckoSourceTimeframe,
  targetTimeframe: ValidatedMarketDataRequest["timeframe"],
) {
  if (sourceTimeframe === targetTimeframe) {
    return candles;
  }

  if (sourceTimeframe === "1H" && targetTimeframe === "4H") {
    return aggregateCandles(candles, fourHoursMs, 4);
  }

  return [];
}

function aggregateCandles(
  candles: CandlePoint[],
  targetTimeframeMs: number,
  minimumCandlesPerBucket: number,
) {
  const grouped = new Map<number, CandlePoint[]>();

  for (const candle of candles) {
    const bucket = Math.floor(
      (Date.parse(candle.timestamp) - 1) / targetTimeframeMs,
    );
    const existing = grouped.get(bucket);

    if (existing) {
      existing.push(candle);
      continue;
    }

    grouped.set(bucket, [candle]);
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .flatMap(([, bucketCandles]) => {
      if (bucketCandles.length < minimumCandlesPerBucket) {
        return [];
      }

      const firstCandle = bucketCandles[0];
      const lastCandle = bucketCandles.at(-1);

      if (!firstCandle || !lastCandle) {
        return [];
      }

      return [
        {
          close: lastCandle.close,
          high: Math.max(...bucketCandles.map((candle) => candle.high)),
          low: Math.min(...bucketCandles.map((candle) => candle.low)),
          open: firstCandle.open,
          timestamp: lastCandle.timestamp,
          volume: Number(
            bucketCandles
              .reduce((total, candle) => total + candle.volume, 0)
              .toFixed(8),
          ),
        },
      ];
    });
}

function resolveNearestVolume(
  targetTimestamp: number,
  volumePoints: Array<[number, number]>,
) {
  const exactMatch = volumePoints.find(
    ([timestamp]) => timestamp === targetTimestamp,
  );

  if (exactMatch) {
    return exactMatch[1];
  }

  const nearestMatch = volumePoints.reduce<
    | {
        distance: number;
        volume: number;
      }
    | undefined
  >((bestMatch, [timestamp, volume]) => {
    const distance = Math.abs(timestamp - targetTimestamp);

    if (!bestMatch || distance < bestMatch.distance) {
      return {
        distance,
        volume,
      };
    }

    return bestMatch;
  }, undefined);

  if (!nearestMatch || nearestMatch.distance > 30 * 60 * 1000) {
    return 0;
  }

  return nearestMatch.volume;
}

function buildCoinGeckoUrl(
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

function resolveCoinGeckoCoinId(asset: Asset) {
  const metadataCoinId =
    typeof asset.metadata.coingeckoCoinId === "string"
      ? asset.metadata.coingeckoCoinId
      : undefined;

  if (metadataCoinId) {
    return metadataCoinId;
  }

  if (asset.symbol === "BTC") {
    return "bitcoin";
  }

  if (asset.symbol === "ETH") {
    return "ethereum";
  }

  if (asset.symbol === "SOL") {
    return "solana";
  }

  throw new MarketDataValidationError(
    providerName,
    "CoinGecko coin id is required for unsupported crypto assets",
    {
      assetId: asset.id,
      symbol: asset.symbol,
    },
  );
}

function calculateChangePercent(current: number, previous: number) {
  if (previous === 0) {
    return 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(4));
}
