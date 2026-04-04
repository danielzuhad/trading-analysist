import {
  type LatestMarketData,
  saveLatestMarketData,
} from "@trading-analyst/db";
import {
  MarketFetchService,
  TwelveDataMarketDataAdapter,
} from "@trading-analyst/market-data";
import type { Asset, SupportedTimeframe } from "@trading-analyst/shared-types";

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

export function createMarketFetchService(apiKey: string) {
  return new MarketFetchService({
    adapters: [new TwelveDataMarketDataAdapter({ apiKey })],
  });
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
