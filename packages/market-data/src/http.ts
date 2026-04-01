import type { Metadata } from "@trading-analyst/shared-types";
import {
  MarketDataProviderError,
  MarketDataTimeoutError,
  MarketDataValidationError,
} from "./errors.js";

export type FetchLike = typeof fetch;

type FetchJsonOptions = {
  fetchFn?: FetchLike;
  provider: string;
  timeoutMs?: number;
};

const defaultTimeoutMs = 10_000;

export async function fetchJson(
  url: URL,
  options: FetchJsonOptions,
): Promise<unknown> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
    });
    const body = await response.text();

    if (!response.ok) {
      throw new MarketDataProviderError(
        options.provider,
        `${options.provider} request failed with ${response.status} ${response.statusText}`,
        {
          responseBody: truncate(body),
          statusCode: response.status,
          url: url.toString(),
        },
      );
    }

    try {
      return JSON.parse(body);
    } catch {
      throw new MarketDataValidationError(
        options.provider,
        `${options.provider} returned a non-JSON payload`,
        {
          responseBody: truncate(body),
          url: url.toString(),
        },
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MarketDataTimeoutError(
        options.provider,
        `${options.provider} request timed out after ${timeoutMs}ms`,
        {
          timeoutMs,
          url: url.toString(),
        },
      );
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new MarketDataTimeoutError(
        options.provider,
        `${options.provider} request timed out after ${timeoutMs}ms`,
        {
          timeoutMs,
          url: url.toString(),
        },
      );
    }

    if (
      error instanceof MarketDataProviderError ||
      error instanceof MarketDataTimeoutError ||
      error instanceof MarketDataValidationError
    ) {
      throw error;
    }

    throw new MarketDataProviderError(
      options.provider,
      `${options.provider} request failed`,
      {
        cause: stringifyUnknownError(error),
        url: url.toString(),
      },
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function stringifyUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function truncate(value: string, maxLength = 400) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

export function buildFreshnessMetadata(
  timeframe: "1H" | "4H",
  latestTimestamp: string,
  fetchedAt: string,
): Metadata {
  const timeframeMs = timeframe === "1H" ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
  const graceMs = 5 * 60 * 1000;
  const ageMs = Math.max(
    0,
    new Date(fetchedAt).getTime() - new Date(latestTimestamp).getTime(),
  );

  return {
    fetchedAt,
    freshnessAgeMinutes: Number((ageMs / 60_000).toFixed(2)),
    isStale: ageMs > timeframeMs + graceMs,
    latestCandleTimestamp: latestTimestamp,
    staleAfterMinutes: (timeframeMs + graceMs) / 60_000,
  };
}
