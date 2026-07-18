import { describe, expect, it, vi } from "vitest";

import {
  buildAiOperationalWarning,
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
      operational: null,
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
      operational: {
        ai: {
          currentState: "ok",
          maxDailyAiCostUsd: 2,
        },
        providers: {
          bybit: {
            detail: "Provider timeout",
            status: "down",
          },
        },
      },
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
      operational: payload.operational,
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
      operational: {
        ai: {
          currentState: "ok",
          maxDailyAiCostUsd: 2,
        },
        providers: {
          bybit: {
            status: "active",
          },
        },
      },
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
      operational: payload.operational,
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
      operational: null,
      status: "api-unreachable",
    });
  });

  it("builds a critical warning when OpenAI quota is exhausted", () => {
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
      operational: {
        ai: {
          checkedAt: "2026-06-08T07:00:00.000Z",
          currentState: "quota-exceeded",
          detail:
            "OpenAI API credits are exhausted or billing is inactive. Add credits, verify billing, then rerun the worker.",
          maxDailyAiCostUsd: 2,
        },
        providers: {},
      },
      service: "api",
      status: "ready",
      timestamp: "2026-06-08T07:00:01.000Z",
    };

    const infrastructureStatus = buildInfrastructureStatus(
      "http://localhost:3001",
      payload,
    );

    expect(buildAiOperationalWarning(infrastructureStatus)).toEqual({
      checkedAt: "2026-06-08T07:00:00.000Z",
      detail:
        "OpenAI API credits are exhausted or billing is inactive. Add credits, verify billing, then rerun the worker.",
      message:
        "New AI analyses are blocked until the OpenAI project has available credits or active billing again.",
      statusLabel: "Quota exceeded",
      title: "OpenAI credits need attention",
      tone: "critical",
    });
  });
});
