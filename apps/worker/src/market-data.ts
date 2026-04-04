import {
  type LatestMarketData,
  saveLatestMarketData,
} from "@trading-analyst/db";
import {
  MarketFetchService,
  TwelveDataMarketDataAdapter,
} from "@trading-analyst/market-data";
import type { Asset, SupportedTimeframe } from "@trading-analyst/shared-types";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

export const defaultCryptoWatchlistAssets: Asset[] = [
  {
    id: "crypto:global:BTC-USD",
    symbol: "BTC",
    displaySymbol: "BTC/USD",
    name: "Bitcoin",
    assetClass: "crypto",
    market: "global",
    exchange: "global",
    instrumentType: "spot",
    baseCurrency: "BTC",
    quoteCurrency: "USD",
    providerSymbol: "BTC/USD",
    isActive: true,
    metadata: {},
  },
  {
    id: "crypto:global:ETH-USD",
    symbol: "ETH",
    displaySymbol: "ETH/USD",
    name: "Ethereum",
    assetClass: "crypto",
    market: "global",
    exchange: "global",
    instrumentType: "spot",
    baseCurrency: "ETH",
    quoteCurrency: "USD",
    providerSymbol: "ETH/USD",
    isActive: true,
    metadata: {},
  },
  {
    id: "crypto:global:SOL-USD",
    symbol: "SOL",
    displaySymbol: "SOL/USD",
    name: "Solana",
    assetClass: "crypto",
    market: "global",
    exchange: "global",
    instrumentType: "spot",
    baseCurrency: "SOL",
    quoteCurrency: "USD",
    providerSymbol: "SOL/USD",
    isActive: true,
    metadata: {},
  },
];

type MarketFetchServiceLike = Pick<MarketFetchService, "fetchMarketData">;

type IngestLatestMarketDataOptions = {
  apiKey: string;
  asset: Asset;
  connectionString?: string;
  fetchService?: MarketFetchServiceLike;
  persistLatestMarketData?: (
    data: LatestMarketData,
    connectionString?: string,
  ) => Promise<LatestMarketData>;
  timeframe: SupportedTimeframe;
};

type ProcessMarketSnapshotJobOptions = {
  apiKey?: string;
  assetId: string;
  connectionString?: string;
  fetchService?: MarketFetchServiceLike;
  logger?: Logger;
  persistLatestMarketData?: (
    data: LatestMarketData,
    connectionString?: string,
  ) => Promise<LatestMarketData>;
  requestedAt: string;
  timeframe: SupportedTimeframe;
};

export type MarketSnapshotJobResult =
  | {
      assetId: string;
      requestedAt: string;
      snapshotId: string;
      status: "stored";
      timeframe: SupportedTimeframe;
    }
  | {
      assetId: string;
      reason: "asset_not_supported" | "missing_api_key";
      requestedAt: string;
      status: "skipped";
      timeframe: SupportedTimeframe;
    };

export function createMarketFetchService(apiKey: string) {
  return new MarketFetchService({
    adapters: [new TwelveDataMarketDataAdapter({ apiKey })],
  });
}

export function findDefaultCryptoAsset(assetId: string) {
  return defaultCryptoWatchlistAssets.find((asset) => asset.id === assetId);
}

export async function ingestLatestMarketData({
  apiKey,
  asset,
  connectionString,
  fetchService = createMarketFetchService(apiKey),
  persistLatestMarketData = saveLatestMarketData,
  timeframe,
}: IngestLatestMarketDataOptions) {
  const marketData = await fetchService.fetchMarketData({
    asset,
    timeframe,
  });

  await persistLatestMarketData(marketData, connectionString);

  return marketData;
}

export async function processMarketSnapshotJob({
  apiKey,
  assetId,
  connectionString,
  fetchService,
  logger = console,
  persistLatestMarketData,
  requestedAt,
  timeframe,
}: ProcessMarketSnapshotJobOptions): Promise<MarketSnapshotJobResult> {
  const asset = findDefaultCryptoAsset(assetId);

  if (!asset) {
    logger.warn(
      `[worker] skipped market snapshot job for unsupported asset "${assetId}"`,
    );

    return {
      assetId,
      reason: "asset_not_supported",
      requestedAt,
      status: "skipped",
      timeframe,
    };
  }

  if (!apiKey) {
    logger.warn(
      `[worker] skipped market snapshot job for ${asset.displaySymbol} because TWELVE_DATA_API_KEY is not configured`,
    );

    return {
      assetId,
      reason: "missing_api_key",
      requestedAt,
      status: "skipped",
      timeframe,
    };
  }

  const marketData = await ingestLatestMarketData({
    apiKey,
    asset,
    timeframe,
    ...(connectionString ? { connectionString } : {}),
    ...(fetchService ? { fetchService } : {}),
    ...(persistLatestMarketData ? { persistLatestMarketData } : {}),
  });

  logger.log(
    `[worker] stored market snapshot ${marketData.snapshot.id} for ${asset.displaySymbol} ${timeframe}`,
  );

  return {
    assetId,
    requestedAt,
    snapshotId: marketData.snapshot.id,
    status: "stored",
    timeframe,
  };
}
