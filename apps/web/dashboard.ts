import {
  type AlertsResponse,
  type AssetOverviewResponse,
  alertsResponseSchema,
  assetOverviewResponseSchema,
  type SupportedTimeframe,
  supportedTimeframeSchema,
  type WatchlistOverviewResponse,
  watchlistOverviewResponseSchema,
} from "@trading-analyst/shared-types";
import { buildApiAuthHeaders } from "./api-auth";

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

export async function fetchWatchlistOverview(
  apiBaseUrl: string | undefined,
  timeframe: SupportedTimeframe,
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<WatchlistOverviewResponse>> {
  if (!apiBaseUrl) {
    return {
      data: null,
      issues: ["Set NEXT_PUBLIC_API_BASE_URL to load the dashboard data."],
      message: "API base URL is not configured.",
      status: "api-unconfigured",
    };
  }

  try {
    const response = await fetchImpl(
      `${apiBaseUrl}/watchlist/overview?timeframe=${timeframe}`,
      {
        cache: "no-store",
        headers: buildApiAuthHeaders(),
      },
    );

    if (!response.ok) {
      return {
        data: null,
        issues: [
          "The watchlist overview endpoint returned an unexpected error.",
        ],
        message: `Watchlist overview request failed with status ${response.status}.`,
        status: "api-unreachable",
      };
    }

    const payload = watchlistOverviewResponseSchema.safeParse(
      await response.json(),
    );

    if (!payload.success) {
      return {
        data: null,
        issues: [
          "The API returned a watchlist overview payload that did not match the expected schema.",
        ],
        message: "Watchlist overview payload is invalid.",
        status: "invalid-response",
      };
    }

    return {
      data: payload.data,
      issues: [],
      message: "Watchlist overview loaded.",
      status: "ready",
    };
  } catch (error) {
    return {
      data: null,
      issues: ["The web app could not reach the watchlist overview endpoint."],
      message:
        error instanceof Error
          ? `Watchlist overview request failed: ${error.message}`
          : "Watchlist overview request failed.",
      status: "api-unreachable",
    };
  }
}

export async function fetchAssetOverview(
  apiBaseUrl: string | undefined,
  assetId: string,
  timeframe: SupportedTimeframe,
  fetchImpl: FetchLike = fetch,
): Promise<DashboardDataResult<AssetOverviewResponse>> {
  if (!apiBaseUrl) {
    return {
      data: null,
      issues: ["Set NEXT_PUBLIC_API_BASE_URL to load the dashboard data."],
      message: "API base URL is not configured.",
      status: "api-unconfigured",
    };
  }

  try {
    const response = await fetchImpl(
      `${apiBaseUrl}/assets/${assetId}/overview?timeframe=${timeframe}`,
      {
        cache: "no-store",
        headers: buildApiAuthHeaders(),
      },
    );

    if (response.status === 404) {
      return {
        data: null,
        issues: ["The requested asset is outside the seeded MVP asset scope."],
        message: "Asset overview is not available for this asset.",
        status: "not-found",
      };
    }

    if (!response.ok) {
      return {
        data: null,
        issues: ["The asset overview endpoint returned an unexpected error."],
        message: `Asset overview request failed with status ${response.status}.`,
        status: "api-unreachable",
      };
    }

    const payload = assetOverviewResponseSchema.safeParse(
      await response.json(),
    );

    if (!payload.success) {
      return {
        data: null,
        issues: [
          "The API returned an asset overview payload that did not match the expected schema.",
        ],
        message: "Asset overview payload is invalid.",
        status: "invalid-response",
      };
    }

    return {
      data: payload.data,
      issues: [],
      message: "Asset overview loaded.",
      status: "ready",
    };
  } catch (error) {
    return {
      data: null,
      issues: ["The web app could not reach the asset overview endpoint."],
      message:
        error instanceof Error
          ? `Asset overview request failed: ${error.message}`
          : "Asset overview request failed.",
      status: "api-unreachable",
    };
  }
}

export async function fetchAlerts(
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
  if (!apiBaseUrl) {
    return {
      data: null,
      issues: ["Set NEXT_PUBLIC_API_BASE_URL to load the dashboard data."],
      message: "API base URL is not configured.",
      status: "api-unconfigured",
    };
  }

  try {
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      ...(assetId ? { assetId } : {}),
      ...(timeframe ? { timeframe } : {}),
    });
    const response = await fetchImpl(`${apiBaseUrl}/alerts?${searchParams}`, {
      cache: "no-store",
      headers: buildApiAuthHeaders(),
    });

    if (!response.ok) {
      return {
        data: null,
        issues: ["The alerts endpoint returned an unexpected error."],
        message: `Alert request failed with status ${response.status}.`,
        status: "api-unreachable",
      };
    }

    const payload = alertsResponseSchema.safeParse(await response.json());

    if (!payload.success) {
      return {
        data: null,
        issues: [
          "The API returned an alert payload that did not match the expected schema.",
        ],
        message: "Alert payload is invalid.",
        status: "invalid-response",
      };
    }

    return {
      data: payload.data,
      issues: [],
      message:
        payload.data.count > 0
          ? "Recent alerts loaded."
          : "No alerts have been generated yet.",
      status: "ready",
    };
  } catch (error) {
    return {
      data: null,
      issues: ["The web app could not reach the alerts endpoint."],
      message:
        error instanceof Error
          ? `Alert request failed: ${error.message}`
          : "Alert request failed.",
      status: "api-unreachable",
    };
  }
}
