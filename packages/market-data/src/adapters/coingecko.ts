import {
  type Asset,
  type MarketCandleSeries,
  marketCandleSeriesSchema,
} from "@trading-analyst/shared-types";
import { z } from "zod";
import { MarketDataValidationError } from "../errors.js";
import { buildFreshnessMetadata, type FetchLike, fetchJson } from "../http.js";
import type {
  MarketDataAdapter,
  ValidatedMarketDataRequest,
} from "../types.js";

const providerName = "coingecko";
const defaultPublicBaseUrl = "https://api.coingecko.com/api/v3";
const defaultProBaseUrl = "https://pro-api.coingecko.com/api/v3";
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

type CoinGeckoMarketDataAdapterOptions = {
  apiKey?: string;
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

export class CoinGeckoMarketDataAdapter implements MarketDataAdapter {
  readonly provider = providerName;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike | undefined;
  private readonly requestTimeoutMs: number | undefined;

  constructor(options: CoinGeckoMarketDataAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? resolveCoinGeckoBaseUrl(options.apiKey);
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
    const [rawOhlc, rawMarketChart] = await Promise.all([
      fetchJson(
        buildCoinGeckoUrl(this.baseUrl, `/coins/${coinId}/ohlc`, {
          days: "90",
          interval: "hourly",
          vs_currency: quoteCurrency.toLowerCase(),
        }),
        this.buildRequestOptions(),
      ),
      fetchJson(
        buildCoinGeckoUrl(this.baseUrl, `/coins/${coinId}/market_chart`, {
          days: "90",
          interval: "hourly",
          vs_currency: quoteCurrency.toLowerCase(),
        }),
        this.buildRequestOptions(),
      ),
    ]);

    const hourlyOhlc = ohlcPayloadSchema.parse(rawOhlc);
    const marketChart = marketChartPayloadSchema.parse(rawMarketChart);
    const hourlyCandles = buildHourlyCandles(hourlyOhlc, marketChart);
    const candles =
      request.timeframe === "4H"
        ? aggregateHourlyCandles(hourlyCandles)
        : hourlyCandles;
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
        hasApiKey: Boolean(this.apiKey),
        providerSymbol:
          request.asset.providerSymbol ?? request.asset.displaySymbol,
        sourceTimeframe: "1H",
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
    const headers = this.apiKey
      ? ({
          "x-cg-pro-api-key": this.apiKey,
        } satisfies Record<string, string>)
      : undefined;

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

function buildHourlyCandles(
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

function aggregateHourlyCandles(candles: CandlePoint[]) {
  const grouped = new Map<number, CandlePoint[]>();

  for (const candle of candles) {
    const bucket = Math.floor((Date.parse(candle.timestamp) - 1) / fourHoursMs);
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
      if (bucketCandles.length < 4) {
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

function resolveCoinGeckoBaseUrl(apiKey: string | undefined) {
  return apiKey ? defaultProBaseUrl : defaultPublicBaseUrl;
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
