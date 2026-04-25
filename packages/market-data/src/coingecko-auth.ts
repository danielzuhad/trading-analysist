export type CoinGeckoApiPlan = "demo" | "basic";

type CoinGeckoAuthOptions = {
  apiKey?: string | undefined;
  apiPlan?: CoinGeckoApiPlan | undefined;
  baseUrl?: string | undefined;
};

const defaultPublicBaseUrl = "https://api.coingecko.com/api/v3";
const defaultProBaseUrl = "https://pro-api.coingecko.com/api/v3";
const defaultApiPlan = "demo" satisfies CoinGeckoApiPlan;

export function resolveCoinGeckoApiPlan(
  apiPlan: CoinGeckoApiPlan | undefined,
): CoinGeckoApiPlan {
  return apiPlan ?? defaultApiPlan;
}

export function resolveCoinGeckoBaseUrl({
  apiPlan,
  baseUrl,
}: CoinGeckoAuthOptions) {
  if (baseUrl) {
    return baseUrl;
  }

  return resolveCoinGeckoApiPlan(apiPlan) === "basic"
    ? defaultProBaseUrl
    : defaultPublicBaseUrl;
}

export function buildCoinGeckoAuthHeaders({
  apiKey,
  apiPlan,
}: CoinGeckoAuthOptions): Record<string, string> | undefined {
  if (!apiKey) {
    return undefined;
  }

  return resolveCoinGeckoApiPlan(apiPlan) === "basic"
    ? { "x-cg-pro-api-key": apiKey }
    : { "x-cg-demo-api-key": apiKey };
}
