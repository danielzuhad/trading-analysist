import { MarketDataProviderError } from "@trading-analyst/market-data";
import { describe, expect, it } from "vitest";
import { formatWorkerError } from "./runtime.js";

describe("worker runtime error formatting", () => {
  it("includes market-data provider status and response body details", () => {
    const error = new MarketDataProviderError(
      "coingecko",
      "coingecko request failed with 400 Bad Request",
      {
        responseBody: '{"error":"invalid api key"}',
        statusCode: 400,
      },
    );

    expect(formatWorkerError(error)).toBe(
      'coingecko request failed with 400 Bad Request status=400 body={"error":"invalid api key"}',
    );
  });
});
