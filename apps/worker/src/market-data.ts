import {
  type LatestMarketData,
  saveLatestIndicatorSnapshot,
  saveLatestMarketData,
  saveLatestSignalAggregationSnapshot,
} from "@trading-analyst/db";
import { buildIndicatorSnapshot } from "@trading-analyst/indicators";
import {
  type CoinGeckoApiPlan,
  CoinGeckoMarketDataAdapter,
  MarketFetchService,
} from "@trading-analyst/market-data";
import {
  type Asset,
  defaultCryptoWatchlistAssets,
  type IndicatorSnapshot,
  type SignalAggregationSnapshot,
  type SupportedTimeframe,
} from "@trading-analyst/shared-types";
import { buildSignalAggregationSnapshot } from "@trading-analyst/signal-aggregation";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

export { defaultCryptoWatchlistAssets };

type MarketFetchServiceLike = Pick<MarketFetchService, "fetchMarketData">;

type IngestLatestMarketDataOptions = {
  apiKey: string;
  apiPlan?: CoinGeckoApiPlan;
  asset: Asset;
  buildIndicator?: (data: LatestMarketData["series"]) => IndicatorSnapshot;
  buildSignalAggregation?: (input: {
    asset: Asset;
    indicatorSnapshot: IndicatorSnapshot;
    marketData: LatestMarketData;
  }) => SignalAggregationSnapshot;
  connectionString?: string;
  fetchService?: MarketFetchServiceLike;
  persistLatestIndicatorSnapshot?: (
    snapshot: IndicatorSnapshot,
    connectionString?: string,
  ) => Promise<IndicatorSnapshot>;
  persistLatestMarketData?: (
    data: LatestMarketData,
    connectionString?: string,
  ) => Promise<LatestMarketData>;
  persistLatestSignalAggregationSnapshot?: (
    snapshot: SignalAggregationSnapshot,
    connectionString?: string,
  ) => Promise<SignalAggregationSnapshot>;
  timeframe: SupportedTimeframe;
};

type ProcessMarketSnapshotJobOptions = {
  apiKey?: string;
  apiPlan?: CoinGeckoApiPlan;
  assetId: string;
  buildIndicator?: (data: LatestMarketData["series"]) => IndicatorSnapshot;
  buildSignalAggregation?: (input: {
    asset: Asset;
    indicatorSnapshot: IndicatorSnapshot;
    marketData: LatestMarketData;
  }) => SignalAggregationSnapshot;
  connectionString?: string;
  fetchService?: MarketFetchServiceLike;
  logger?: Logger;
  persistLatestIndicatorSnapshot?: (
    snapshot: IndicatorSnapshot,
    connectionString?: string,
  ) => Promise<IndicatorSnapshot>;
  persistLatestMarketData?: (
    data: LatestMarketData,
    connectionString?: string,
  ) => Promise<LatestMarketData>;
  persistLatestSignalAggregationSnapshot?: (
    snapshot: SignalAggregationSnapshot,
    connectionString?: string,
  ) => Promise<SignalAggregationSnapshot>;
  requestedAt: string;
  timeframe: SupportedTimeframe;
};

export type MarketSnapshotJobResult =
  | {
      assetId: string;
      indicatorSnapshotId: string;
      requestedAt: string;
      snapshotId: string;
      signalBias: SignalAggregationSnapshot["bias"];
      signalSnapshotId: string;
      signalStrengthScore: number;
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

export function createMarketFetchService(
  apiKey: string,
  apiPlan: CoinGeckoApiPlan = "demo",
) {
  return new MarketFetchService({
    adapters: [new CoinGeckoMarketDataAdapter({ apiKey, apiPlan })],
  });
}

export function findDefaultCryptoAsset(assetId: string) {
  return defaultCryptoWatchlistAssets.find((asset) => asset.id === assetId);
}

export async function ingestLatestMarketData({
  apiKey,
  apiPlan = "demo",
  asset,
  buildIndicator = (series) => buildIndicatorSnapshot({ marketSeries: series }),
  buildSignalAggregation = ({
    asset: currentAsset,
    indicatorSnapshot,
    marketData,
  }) =>
    buildSignalAggregationSnapshot({
      asset: currentAsset,
      generatedAt: marketData.snapshot.capturedAt,
      indicatorSnapshot,
      marketSnapshot: marketData.snapshot,
    }),
  connectionString,
  fetchService = createMarketFetchService(apiKey, apiPlan),
  persistLatestIndicatorSnapshot = saveLatestIndicatorSnapshot,
  persistLatestMarketData = saveLatestMarketData,
  persistLatestSignalAggregationSnapshot = saveLatestSignalAggregationSnapshot,
  timeframe,
}: IngestLatestMarketDataOptions) {
  const marketData = await fetchService.fetchMarketData({
    asset,
    timeframe,
  });

  await persistLatestMarketData(marketData, connectionString);
  const indicatorSnapshot = buildIndicator(marketData.series);
  await persistLatestIndicatorSnapshot(indicatorSnapshot, connectionString);
  const signalAggregationSnapshot = buildSignalAggregation({
    asset,
    indicatorSnapshot,
    marketData,
  });
  await persistLatestSignalAggregationSnapshot(
    signalAggregationSnapshot,
    connectionString,
  );

  return {
    indicatorSnapshot,
    marketData,
    signalAggregationSnapshot,
  };
}

export async function processMarketSnapshotJob({
  apiKey,
  apiPlan = "demo",
  assetId,
  buildIndicator,
  buildSignalAggregation,
  connectionString,
  fetchService,
  logger = console,
  persistLatestIndicatorSnapshot,
  persistLatestMarketData,
  persistLatestSignalAggregationSnapshot,
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
      `[worker] skipped market snapshot job for ${asset.displaySymbol} because COINGECKO_API_KEY is not configured`,
    );

    return {
      assetId,
      reason: "missing_api_key",
      requestedAt,
      status: "skipped",
      timeframe,
    };
  }

  const { indicatorSnapshot, marketData, signalAggregationSnapshot } =
    await ingestLatestMarketData({
      apiKey,
      apiPlan,
      asset,
      timeframe,
      ...(buildIndicator ? { buildIndicator } : {}),
      ...(buildSignalAggregation ? { buildSignalAggregation } : {}),
      ...(connectionString ? { connectionString } : {}),
      ...(fetchService ? { fetchService } : {}),
      ...(persistLatestIndicatorSnapshot
        ? { persistLatestIndicatorSnapshot }
        : {}),
      ...(persistLatestMarketData ? { persistLatestMarketData } : {}),
      ...(persistLatestSignalAggregationSnapshot
        ? { persistLatestSignalAggregationSnapshot }
        : {}),
    });

  logger.log(
    `[worker] stored market snapshot ${marketData.snapshot.id}, indicator snapshot ${indicatorSnapshot.id}, and signal snapshot ${signalAggregationSnapshot.id} for ${asset.displaySymbol} ${timeframe} with score ${signalAggregationSnapshot.signalStrengthScore}`,
  );

  return {
    assetId,
    indicatorSnapshotId: indicatorSnapshot.id,
    requestedAt,
    snapshotId: marketData.snapshot.id,
    signalBias: signalAggregationSnapshot.bias,
    signalSnapshotId: signalAggregationSnapshot.id,
    signalStrengthScore: signalAggregationSnapshot.signalStrengthScore,
    status: "stored",
    timeframe,
  };
}
