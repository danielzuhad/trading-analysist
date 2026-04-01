import { marketSnapshotSchema } from "@trading-analyst/shared-types";
import {
  MarketDataConfigurationError,
  MarketDataValidationError,
} from "./errors.js";
import type {
  MarketDataAdapter,
  MarketDataRequest,
  MarketDataResult,
  ValidatedMarketDataRequest,
} from "./types.js";
import { marketDataRequestSchema } from "./types.js";

type DefaultProviderByAssetClass = Partial<Record<"crypto" | "stock", string>>;

type MarketFetchServiceOptions = {
  adapters: MarketDataAdapter[];
  defaultProviderByAssetClass?: Partial<DefaultProviderByAssetClass>;
};

const defaultProviderByAssetClass: DefaultProviderByAssetClass = {
  crypto: "twelve-data",
};

export class MarketFetchService {
  private readonly adaptersByProvider: Map<string, MarketDataAdapter>;
  private readonly defaultProviderByAssetClass: DefaultProviderByAssetClass;

  constructor(options: MarketFetchServiceOptions) {
    this.adaptersByProvider = new Map(
      options.adapters.map((adapter) => [adapter.provider, adapter]),
    );
    this.defaultProviderByAssetClass = {
      ...defaultProviderByAssetClass,
      ...options.defaultProviderByAssetClass,
    };
  }

  async fetchMarketData(request: MarketDataRequest): Promise<MarketDataResult> {
    const validatedRequest = this.validateRequest(request);
    const adapter = this.resolveAdapter(validatedRequest);
    const series = await adapter.fetchSeries(validatedRequest);

    const latestCandle = series.candles.at(-1);

    if (!latestCandle) {
      throw new MarketDataValidationError(
        adapter.provider,
        "Market candle series cannot be empty",
        {
          assetId: validatedRequest.asset.id,
        },
      );
    }

    const snapshot = marketSnapshotSchema.parse({
      assetId: series.assetId,
      askPrice: series.askPrice,
      baseCurrency: series.baseCurrency,
      bidPrice: series.bidPrice,
      candle: {
        close: latestCandle.close,
        high: latestCandle.high,
        low: latestCandle.low,
        open: latestCandle.open,
        volume: latestCandle.volume,
      },
      capturedAt: series.capturedAt,
      eventFlags: series.eventFlags,
      id: buildSnapshotId(series.assetId, series.provider, series.timeframe),
      lastPrice: series.lastPrice,
      marketSession: series.marketSession,
      metadata: {
        ...series.metadata,
        candleCount: series.candles.length,
      },
      priceChangePercent: series.priceChangePercent,
      provider: series.provider,
      quoteCurrency: series.quoteCurrency,
      timeframe: series.timeframe,
      volumeWeightedAveragePrice: series.volumeWeightedAveragePrice,
    });

    return {
      series,
      snapshot,
    };
  }

  async fetchSeries(request: MarketDataRequest) {
    return (await this.fetchMarketData(request)).series;
  }

  async fetchSnapshot(request: MarketDataRequest) {
    return (await this.fetchMarketData(request)).snapshot;
  }

  private resolveAdapter(request: ValidatedMarketDataRequest) {
    const provider =
      request.provider ??
      this.defaultProviderByAssetClass[request.asset.assetClass];

    if (!provider) {
      throw new MarketDataConfigurationError(
        request.asset.assetClass,
        `No default market data provider configured for asset class "${request.asset.assetClass}"`,
        {
          assetClass: request.asset.assetClass,
          assetId: request.asset.id,
        },
      );
    }

    const adapter = this.adaptersByProvider.get(provider);

    if (!adapter) {
      throw new MarketDataConfigurationError(
        provider,
        `No market data adapter registered for provider "${provider}"`,
        {
          assetClass: request.asset.assetClass,
          assetId: request.asset.id,
        },
      );
    }

    return adapter;
  }

  private validateRequest(
    request: MarketDataRequest,
  ): ValidatedMarketDataRequest {
    const parsedRequest = marketDataRequestSchema.parse(request);

    const validatedRequest: ValidatedMarketDataRequest = {
      asset: parsedRequest.asset,
      candleLimit: parsedRequest.candleLimit,
      requestedAt: parsedRequest.requestedAt ?? new Date().toISOString(),
      timeframe: parsedRequest.timeframe,
    };

    if (parsedRequest.provider) {
      validatedRequest.provider = parsedRequest.provider;
    }

    return validatedRequest;
  }
}

function buildSnapshotId(assetId: string, provider: string, timeframe: string) {
  return `market:${provider}:${assetId}:${timeframe}`;
}
