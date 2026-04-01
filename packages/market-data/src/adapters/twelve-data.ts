import {
  type Asset,
  type MarketCandleSeries,
  marketCandleSeriesSchema,
} from "@trading-analyst/shared-types";
import { z } from "zod";
import {
  MarketDataConfigurationError,
  MarketDataValidationError,
} from "../errors.js";
import { buildFreshnessMetadata, type FetchLike, fetchJson } from "../http.js";
import { parseProviderDateTime } from "../time.js";
import type {
  MarketDataAdapter,
  ValidatedMarketDataRequest,
} from "../types.js";

const providerName = "twelve-data";
const defaultBaseUrl = "https://api.twelvedata.com";

const numericValueSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().finite());

const volumeValueSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    return Number(value);
  })
  .pipe(z.number().finite().min(0));

const booleanishSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return value.toLowerCase() === "true";
  });

const twelveDataErrorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  message: z.string(),
  status: z.literal("error"),
});

const twelveDataTimeSeriesSchema = z.object({
  meta: z.object({
    currency: z.string().optional(),
    exchange: z.string().optional(),
    exchange_timezone: z.string().optional(),
    interval: z.string(),
    symbol: z.string(),
    type: z.string().optional(),
  }),
  values: z
    .array(
      z.object({
        close: numericValueSchema,
        datetime: z.string(),
        high: numericValueSchema,
        low: numericValueSchema,
        open: numericValueSchema,
        volume: volumeValueSchema.optional().default(0),
      }),
    )
    .min(1),
});

const twelveDataQuoteSchema = z.object({
  close: numericValueSchema.optional(),
  datetime: z.string().optional(),
  is_market_open: booleanishSchema.optional(),
  percent_change: numericValueSchema.optional(),
});

type TwelveDataAdapterOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: FetchLike;
  requestTimeoutMs?: number;
};

export class TwelveDataMarketDataAdapter implements MarketDataAdapter {
  readonly provider = providerName;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike | undefined;
  private readonly requestTimeoutMs: number | undefined;

  constructor(options: TwelveDataAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.fetchFn = options.fetchFn;
    this.requestTimeoutMs = options.requestTimeoutMs;
  }

  async fetchSeries(
    request: ValidatedMarketDataRequest,
  ): Promise<MarketCandleSeries> {
    if (request.asset.assetClass !== "crypto") {
      throw new MarketDataValidationError(
        this.provider,
        "Twelve Data adapter only supports crypto assets in the current MVP",
        {
          assetClass: request.asset.assetClass,
          assetId: request.asset.id,
        },
      );
    }

    if (!this.apiKey) {
      throw new MarketDataConfigurationError(
        this.provider,
        "TWELVE_DATA_API_KEY is required for crypto market data requests",
        {
          assetId: request.asset.id,
        },
      );
    }

    const symbol = resolveTwelveDataSymbol(request.asset);
    const interval = mapTimeframeToTwelveDataInterval(request.timeframe);

    const timeSeriesUrl = new URL("/time_series", this.baseUrl);
    timeSeriesUrl.searchParams.set("apikey", this.apiKey);
    timeSeriesUrl.searchParams.set("interval", interval);
    timeSeriesUrl.searchParams.set("outputsize", String(request.candleLimit));
    timeSeriesUrl.searchParams.set("symbol", symbol);

    const quoteUrl = new URL("/quote", this.baseUrl);
    quoteUrl.searchParams.set("apikey", this.apiKey);
    quoteUrl.searchParams.set("symbol", symbol);

    const [rawSeries, rawQuote] = await Promise.all([
      fetchJson(timeSeriesUrl, this.buildRequestOptions()),
      fetchJson(quoteUrl, this.buildRequestOptions()),
    ]);

    const timeSeriesPayload = parseTwelveDataResponse(
      rawSeries,
      twelveDataTimeSeriesSchema,
      this.provider,
    );
    const quotePayload = parseTwelveDataResponse(
      rawQuote,
      twelveDataQuoteSchema,
      this.provider,
    );
    const exchangeTimeZone = timeSeriesPayload.meta.exchange_timezone ?? "UTC";
    const candles = [...timeSeriesPayload.values]
      .sort((left, right) => left.datetime.localeCompare(right.datetime))
      .map((candle) => ({
        close: candle.close,
        high: candle.high,
        low: candle.low,
        open: candle.open,
        timestamp: parseProviderDateTime(candle.datetime, exchangeTimeZone),
        volume: candle.volume ?? 0,
      }));
    const latestCandle = candles.at(-1);

    if (!latestCandle) {
      throw new MarketDataValidationError(
        this.provider,
        "Twelve Data returned an empty candle response",
        {
          assetId: request.asset.id,
          symbol,
        },
      );
    }

    const fetchedAt = new Date().toISOString();

    return marketCandleSeriesSchema.parse({
      assetId: request.asset.id,
      baseCurrency: request.asset.baseCurrency,
      candles,
      capturedAt: latestCandle.timestamp,
      eventFlags: [],
      lastPrice: quotePayload.close ?? latestCandle.close,
      marketSession: "continuous",
      metadata: {
        ...buildFreshnessMetadata(
          request.timeframe,
          latestCandle.timestamp,
          fetchedAt,
        ),
        candleCount: candles.length,
        exchange: timeSeriesPayload.meta.exchange ?? request.asset.exchange,
        exchangeTimeZone,
        interval,
        providerSymbol: symbol,
      },
      priceChangePercent: quotePayload.percent_change,
      provider: this.provider,
      quoteCurrency:
        request.asset.quoteCurrency ?? timeSeriesPayload.meta.currency,
      timeframe: request.timeframe,
    });
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

function parseTwelveDataResponse<TSchema extends z.ZodTypeAny>(
  payload: unknown,
  schema: TSchema,
  provider: string,
): z.infer<TSchema> {
  const errorResult = twelveDataErrorSchema.safeParse(payload);

  if (errorResult.success) {
    throw new MarketDataValidationError(
      provider,
      `Twelve Data responded with an error: ${errorResult.data.message}`,
      {
        providerCode: errorResult.data.code,
      },
    );
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new MarketDataValidationError(
      provider,
      "Twelve Data returned an invalid payload",
      {
        issues: result.error.issues,
      },
    );
  }

  return result.data;
}

function mapTimeframeToTwelveDataInterval(timeframe: "1H" | "4H") {
  return timeframe === "1H" ? "1h" : "4h";
}

function resolveTwelveDataSymbol(asset: Asset) {
  if (asset.providerSymbol) {
    return asset.providerSymbol;
  }

  if (asset.baseCurrency && asset.quoteCurrency) {
    return `${asset.baseCurrency}/${asset.quoteCurrency}`;
  }

  return asset.displaySymbol.replaceAll("-", "/");
}
