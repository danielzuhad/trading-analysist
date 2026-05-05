import type { AiAnalysisProvider } from "@trading-analyst/ai-analysis";
import {
  getActivePositionForAsset,
  saveServiceHeartbeat,
} from "@trading-analyst/db";
import {
  BybitContextProvider,
  type CoinGeckoApiPlan,
  CoinGeckoContextProvider,
  FearAndGreedContextProvider,
  MarketContextService,
} from "@trading-analyst/market-data";
import type { SupportedTimeframe } from "@trading-analyst/shared-types";
import { buildSignalAggregationSnapshot } from "@trading-analyst/signal-aggregation";
import {
  type GenerateLatestAssetAnalysisResult,
  generateAssetAnalysisFromSignalSnapshot,
} from "./analysis.js";
import {
  createMarketFetchService,
  findDefaultCryptoAsset,
  ingestLatestMarketData,
} from "./market-data.js";

type Logger = Pick<typeof console, "error" | "log" | "warn">;

type RunAnalysisCycleOptions = {
  aiProvider?: AiAnalysisProvider;
  assetId: string;
  coingeckoApiKey?: string;
  coingeckoApiPlan?: CoinGeckoApiPlan;
  connectionString?: string;
  contextService?: Pick<MarketContextService, "fetchContext">;
  fetchService?: ReturnType<typeof createMarketFetchService>;
  getActivePositionForAssetFn?: typeof getActivePositionForAsset;
  generateAnalysisFromSignalSnapshotFn?: typeof generateAssetAnalysisFromSignalSnapshot;
  ingestLatestMarketDataFn?: typeof ingestLatestMarketData;
  logger?: Logger;
  maxDailyAiCostUsd?: number;
  openAiApiKey?: string;
  requestedAt: string;
  saveHeartbeat?: typeof saveServiceHeartbeat;
  timeframe: SupportedTimeframe;
  whatsappAlertDelivery?: {
    accountSid: string;
    authToken: string;
    from: string;
    statusCallbackUrl?: string;
    to: string;
  };
};

export type AnalysisCycleResult =
  | {
      analysis: GenerateLatestAssetAnalysisResult;
      assetId: string;
      contextPartial: boolean;
      marketStatus: "stored";
      status: "stored";
      timeframe: SupportedTimeframe;
    }
  | {
      assetId: string;
      reason: "asset_not_supported" | "missing_api_key";
      status: "skipped";
      timeframe: SupportedTimeframe;
    };

export async function runAnalysisCycle({
  aiProvider,
  assetId,
  coingeckoApiKey,
  coingeckoApiPlan = "demo",
  connectionString,
  contextService,
  fetchService,
  getActivePositionForAssetFn = getActivePositionForAsset,
  generateAnalysisFromSignalSnapshotFn = generateAssetAnalysisFromSignalSnapshot,
  ingestLatestMarketDataFn = ingestLatestMarketData,
  logger = console,
  maxDailyAiCostUsd,
  openAiApiKey,
  requestedAt,
  saveHeartbeat = saveServiceHeartbeat,
  timeframe,
  whatsappAlertDelivery,
}: RunAnalysisCycleOptions): Promise<AnalysisCycleResult> {
  const asset = findDefaultCryptoAsset(assetId);

  if (!asset) {
    logger.warn(
      `[worker] skipped analysis cycle for unsupported asset "${assetId}"`,
    );

    return {
      assetId,
      reason: "asset_not_supported",
      status: "skipped",
      timeframe,
    };
  }

  if (!coingeckoApiKey) {
    logger.warn(
      `[worker] skipped analysis cycle for ${asset.displaySymbol} because COINGECKO_API_KEY is not configured`,
    );

    return {
      assetId,
      reason: "missing_api_key",
      status: "skipped",
      timeframe,
    };
  }

  const marketContextService =
    contextService ??
    createMarketContextService({
      ...(coingeckoApiKey ? { coingeckoApiKey } : {}),
      coingeckoApiPlan,
    });
  const marketContext = await marketContextService.fetchContext({
    asset,
    generatedAt: requestedAt,
    timeframe,
  });

  await persistOperationalHeartbeats({
    marketContext,
    saveHeartbeat,
    ...(connectionString ? { connectionString } : {}),
  });

  const activePosition = await getActivePositionForAssetFn({
    assetId: asset.id,
    ...(connectionString ? { connectionString } : {}),
  });

  const { signalAggregationSnapshot } = await ingestLatestMarketDataFn({
    apiKey: coingeckoApiKey,
    apiPlan: coingeckoApiPlan,
    asset,
    buildSignalAggregation: ({
      asset: currentAsset,
      indicatorSnapshot,
      marketData,
    }) =>
      buildSignalAggregationSnapshot({
        asset: currentAsset,
        generatedAt: marketData.snapshot.capturedAt,
        indicatorSnapshot,
        marketContext,
        marketSnapshot: marketData.snapshot,
        ...(activePosition ? { position: activePosition } : {}),
      }),
    ...(connectionString ? { connectionString } : {}),
    ...(fetchService
      ? { fetchService }
      : {
          fetchService: createMarketFetchService(
            coingeckoApiKey,
            coingeckoApiPlan,
          ),
        }),
    timeframe,
  });

  const analysis = await generateAnalysisFromSignalSnapshotFn({
    logger,
    ...(connectionString ? { connectionString } : {}),
    ...(maxDailyAiCostUsd !== undefined ? { maxDailyAiCostUsd } : {}),
    ...(openAiApiKey ? { openAiApiKey } : {}),
    ...(aiProvider ? { provider: aiProvider } : {}),
    signalSnapshot: signalAggregationSnapshot,
    timeframe,
    ...(whatsappAlertDelivery ? { whatsappAlertDelivery } : {}),
  });

  await persistAiHeartbeat({
    analysis,
    requestedAt,
    saveHeartbeat,
    ...(connectionString ? { connectionString } : {}),
    ...(maxDailyAiCostUsd !== undefined ? { maxDailyAiCostUsd } : {}),
  });

  return {
    analysis,
    assetId,
    contextPartial: marketContext.isPartial,
    marketStatus: "stored",
    status: "stored",
    timeframe,
  };
}

function createMarketContextService({
  coingeckoApiKey,
  coingeckoApiPlan,
}: {
  coingeckoApiKey?: string;
  coingeckoApiPlan: CoinGeckoApiPlan;
}) {
  return new MarketContextService({
    providers: [
      new FearAndGreedContextProvider(),
      new BybitContextProvider(),
      new CoinGeckoContextProvider({
        ...(coingeckoApiKey ? { apiKey: coingeckoApiKey } : {}),
        apiPlan: coingeckoApiPlan,
      }),
    ],
  });
}

async function persistOperationalHeartbeats({
  connectionString,
  marketContext,
  saveHeartbeat,
}: {
  connectionString?: string;
  marketContext: Awaited<ReturnType<MarketContextService["fetchContext"]>>;
  saveHeartbeat: typeof saveServiceHeartbeat;
}) {
  await Promise.all(
    marketContext.providers.map((provider) =>
      saveHeartbeat(
        {
          checkedAt: provider.checkedAt,
          payload: {
            ...(provider.detail ? { detail: provider.detail } : {}),
            ...(provider.latencyMs !== undefined
              ? { latencyMs: provider.latencyMs }
              : {}),
            ...(Object.keys(provider.metadata).length > 0
              ? { metadata: provider.metadata }
              : {}),
          },
          serviceName: `provider:${provider.provider}`,
          status: provider.status,
        },
        connectionString,
      ),
    ),
  );
}

async function persistAiHeartbeat({
  analysis,
  connectionString,
  maxDailyAiCostUsd,
  requestedAt,
  saveHeartbeat,
}: {
  analysis: GenerateLatestAssetAnalysisResult;
  connectionString?: string;
  maxDailyAiCostUsd?: number;
  requestedAt: string;
  saveHeartbeat: typeof saveServiceHeartbeat;
}) {
  await saveHeartbeat(
    {
      checkedAt: requestedAt,
      payload: {
        assetId: analysis.assetId,
        ...(maxDailyAiCostUsd !== undefined ? { maxDailyAiCostUsd } : {}),
        timeframe: analysis.timeframe,
      },
      serviceName: "ai:daily-cost-cap",
      status: resolveAiHeartbeatStatus(analysis),
    },
    connectionString,
  );
}

function resolveAiHeartbeatStatus(analysis: GenerateLatestAssetAnalysisResult) {
  if (analysis.status === "stored") {
    return "ok";
  }

  if (analysis.reason === "daily_cost_cap_reached") {
    return "degraded";
  }

  if (analysis.reason === "missing_openai_api_key") {
    return "disabled";
  }

  return "degraded";
}
