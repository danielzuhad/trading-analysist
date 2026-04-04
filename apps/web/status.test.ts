import { describe, expect, it } from "vitest";

import { buildInfrastructureStatus, type ReadyzPayload } from "./status";

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
});
