import {
  type AlertsResponse,
  type AssetOverviewResponse,
  alertsResponseSchema,
  assetOverviewResponseSchema,
  type PortfolioOverviewResponse,
  portfolioOverviewResponseSchema,
  type SupportedTimeframe,
  supportedTimeframeSchema,
  type WatchlistOverviewResponse,
  type WatchlistResponse,
  watchlistOverviewResponseSchema,
  watchlistResponseSchema,
} from "@trading-analyst/shared-types";
import { redirect } from "next/navigation";
import type { ZodType } from "zod";
import { buildApiAuthHeaders } from "./api-auth";
import { clearSessionCookie } from "./session";

export type DashboardDataStatus =
  | "api-unconfigured"
  | "api-unreachable"
  | "invalid-response"
  | "not-found"
  | "ready";

export type DashboardDataResult<T> = {
  data: T | null;
  issues: string[];
  message: string;
  status: DashboardDataStatus;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "json" | "ok" | "status">>;

export function resolveDashboardTimeframe(
  value: string | string[] | undefined,
): SupportedTimeframe {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = supportedTimeframeSchema.safeParse(candidate);

  return parsed.success ? parsed.data : "4H";
}

type DashboardResourceMessages<T> = {
  endpointLabel: string;
  invalid: string;
  notFound?: string;
  requestFailedPrefix: string;
  success: (data: T) => string;
  unreachable: string;
};

async function fetchDashboardResource<T>(
  apiBaseUrl: string | undefined,
  url: string,
  schema: ZodType<T>,
  messages: DashboardResourceMessages<T>,
  fetchImpl: FetchLike,
): Promise<DashboardDataResult<T>> {
  if (!apiBaseUrl) {
    return {
      data: null,
      issues: ["Set NEXT_PUBLIC_API_BASE_URL to load the dashboard data."],
      message: "API base URL is not configured.",
      status: "api-unconfigured",
    };
  }

  let response: Pick<Response, "json" | "ok" | "status">;

  try {
    response = await fetchImpl(url, {
      cache: "no-store",
      headers: await buildApiAuthHeaders(),
    });
  } catch (error) {
    return {
      data: null,
      issues: [
        `The web app could not reach the ${messages.endpointLabel} endpoint.`,
      ],
      message:
        error instanceof Error
          ? `${messages.requestFailedPrefix} request failed: ${error.message}`
          : `${messages.requestFailedPrefix} request failed.`,
      status: "api-unreachable",
    };
  }

  // Not caught above: redirect() throws a Next.js control-flow signal that
  // must propagate to the framework, not be swallowed as a fetch error.
  if (response.status === 401) {
    await clearSessionCookie();
    redirect("/login");
  }

  if (messages.notFound && response.status === 404) {
    return {
      data: null,
      issues: ["The requested asset is outside the seeded MVP asset scope."],
      message: messages.notFound,
      status: "not-found",
    };
  }

  if (!response.ok) {
    return {
      data: null,
      issues: [messages.unreachable],
      message: `${messages.requestFailedPrefix} failed with status ${response.status}.`,
      status: "api-unreachable",
    };
  }

  const payload = schema.safeParse(await response.json());

  if (!payload.success) {
    return {
      data: null,
      issues: [messages.invalid],
      message: `${messages.requestFailedPrefix} payload is invalid.`,
      status: "invalid-response",
    };
  }

  return {
    data: payload.data,
    issues: [],
    message: messages.success(payload.data),
    status: "ready",
  };
}

export function fetchWatchlistOverview(
  apiBaseUrl: string | undefined,
  timeframe: SupportedTimeframe,
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<WatchlistOverviewResponse>> {
  return fetchDashboardResource(
    apiBaseUrl,
    `${apiBaseUrl}/watchlist/overview?timeframe=${timeframe}`,
    watchlistOverviewResponseSchema,
    {
      endpointLabel: "watchlist overview",
      invalid:
        "The API returned a watchlist overview payload that did not match the expected schema.",
      requestFailedPrefix: "Watchlist overview",
      success: () => "Watchlist overview loaded.",
      unreachable:
        "The watchlist overview endpoint returned an unexpected error.",
    },
    fetchImpl,
  );
}

export function fetchAssetOverview(
  apiBaseUrl: string | undefined,
  assetId: string,
  timeframe: SupportedTimeframe,
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<AssetOverviewResponse>> {
  return fetchDashboardResource(
    apiBaseUrl,
    `${apiBaseUrl}/assets/${assetId}/overview?timeframe=${timeframe}`,
    assetOverviewResponseSchema,
    {
      endpointLabel: "asset overview",
      invalid:
        "The API returned an asset overview payload that did not match the expected schema.",
      notFound: "Asset overview is not available for this asset.",
      requestFailedPrefix: "Asset overview",
      success: () => "Asset overview loaded.",
      unreachable: "The asset overview endpoint returned an unexpected error.",
    },
    fetchImpl,
  );
}

export function fetchWatchlist(
  apiBaseUrl: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<WatchlistResponse>> {
  return fetchDashboardResource(
    apiBaseUrl,
    `${apiBaseUrl}/watchlist`,
    watchlistResponseSchema,
    {
      endpointLabel: "watchlist",
      invalid:
        "The API returned a watchlist payload that did not match the expected schema.",
      requestFailedPrefix: "Watchlist",
      success: () => "Watchlist loaded.",
      unreachable: "The watchlist endpoint returned an unexpected error.",
    },
    fetchImpl,
  );
}

export function fetchPortfolioOverview(
  apiBaseUrl: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<PortfolioOverviewResponse>> {
  return fetchDashboardResource(
    apiBaseUrl,
    `${apiBaseUrl}/portfolio/overview`,
    portfolioOverviewResponseSchema,
    {
      endpointLabel: "portfolio overview",
      invalid:
        "The API returned a portfolio overview payload that did not match the expected schema.",
      requestFailedPrefix: "Portfolio overview",
      success: (data) =>
        data.openPositionCount > 0
          ? "Portfolio overview loaded."
          : "No open positions yet.",
      unreachable:
        "The portfolio overview endpoint returned an unexpected error.",
    },
    fetchImpl,
  );
}

export function fetchAlerts(
  apiBaseUrl: string | undefined,
  {
    assetId,
    limit = 6,
    timeframe,
  }: {
    assetId?: string;
    limit?: number;
    timeframe?: SupportedTimeframe;
  } = {},
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<AlertsResponse>> {
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    ...(assetId ? { assetId } : {}),
    ...(timeframe ? { timeframe } : {}),
  });

  return fetchDashboardResource(
    apiBaseUrl,
    `${apiBaseUrl}/alerts?${searchParams}`,
    alertsResponseSchema,
    {
      endpointLabel: "alerts",
      invalid:
        "The API returned an alert payload that did not match the expected schema.",
      requestFailedPrefix: "Alert",
      success: (data) =>
        data.count > 0
          ? "Recent alerts loaded."
          : "No alerts have been generated yet.",
      unreachable: "The alerts endpoint returned an unexpected error.",
    },
    fetchImpl,
  );
}
