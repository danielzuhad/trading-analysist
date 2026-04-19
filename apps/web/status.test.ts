import { describe, expect, it, vi } from "vitest";

import {
  buildInfrastructureStatus,
  fetchInfrastructureStatus,
  type ReadyzPayload,
} from "./status";

describe("web infrastructure status", () => {
  it("surfaces a missing API base URL clearly", () => {
    expect(buildInfrastructureStatus(undefined, null)).toEqual({
      checks: null,
      issues: [
        "Set NEXT_PUBLIC_API_BASE_URL to enable live infrastructure checks.",
      ],
      message: "API base URL is not configured.",
      status: "api-unconfigured",
    });
  });

  it("keeps degraded Redis messaging visible to the web app", () => {
    const payload: ReadyzPayload = {
      checks: {
        database: {
          ok: true,
          target: "127.0.0.1:5432",
        },
        redis: {
          hint: "Start Redis or Docker Compose, then retry the worker and API.",
          message:
            "Redis is not reachable at 127.0.0.1:6379. The worker will keep logging connection errors until Redis is available.",
          ok: false,
          target: "127.0.0.1:6379",
        },
      },
      issues: [
        "Redis is not reachable at 127.0.0.1:6379. The worker will keep logging connection errors until Redis is available.",
      ],
      service: "api",
      status: "degraded",
      timestamp: "2026-04-04T10:00:00.000Z",
    };

    expect(
      buildInfrastructureStatus("http://localhost:3001", payload),
    ).toMatchObject({
      checks: payload.checks,
      issues: payload.issues,
      message:
        "The API is running, but one or more infrastructure dependencies are degraded.",
      status: "degraded",
    });
  });

  it("loads live readiness data through fetch", async () => {
    const payload: ReadyzPayload = {
      checks: {
        database: {
          ok: true,
          target: "127.0.0.1:5432",
        },
        redis: {
          ok: true,
          target: "127.0.0.1:6379",
        },
      },
      issues: [],
      service: "api",
      status: "ready",
      timestamp: "2026-04-19T08:48:23.811Z",
    };
    const fetchMock = vi.fn(async () => ({
      json: async () => payload,
    }));

    await expect(
      fetchInfrastructureStatus("http://localhost:3001", fetchMock),
    ).resolves.toMatchObject({
      checks: payload.checks,
      issues: [],
      message: "API, PostgreSQL, and Redis are reachable.",
      status: "ready",
    });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/readyz", {
      cache: "no-store",
    });
  });

  it("surfaces browser fetch failures clearly", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });

    await expect(
      fetchInfrastructureStatus("http://localhost:3001", fetchMock),
    ).resolves.toMatchObject({
      checks: null,
      issues: [
        "The web app could not reach the API readiness endpoint.",
        "Make sure the API is running on the configured host and port.",
      ],
      message: "API readiness request failed: Failed to fetch",
      status: "api-unreachable",
    });
  });
});
