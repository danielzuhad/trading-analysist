import { type Asset, assetSchema } from "./asset.js";

export const defaultCryptoWatchlistAssets: Asset[] = [
  assetSchema.parse({
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
    metadata: {
      coingeckoCoinId: "bitcoin",
      imageUrl: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    },
  }),
  assetSchema.parse({
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
    metadata: {
      coingeckoCoinId: "ethereum",
      imageUrl:
        "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    },
  }),
  assetSchema.parse({
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
    metadata: {
      coingeckoCoinId: "solana",
      imageUrl:
        "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    },
  }),
];

export function findDefaultCryptoAsset(assetId: string) {
  return defaultCryptoWatchlistAssets.find((asset) => asset.id === assetId);
}

export function findDefaultCryptoAssetBySymbol(symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  return defaultCryptoWatchlistAssets.find(
    (asset) => asset.symbol.toUpperCase() === normalizedSymbol,
  );
}
