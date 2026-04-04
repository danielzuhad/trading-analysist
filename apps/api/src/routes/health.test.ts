import { describe, expect, it } from "vitest";

import {
  formatInfrastructureCheckFailure,
  formatServiceTarget,
} from "./health.js";

describe("health route helpers", () => {
  it("extracts host and port from service URLs", () => {
    expect(
      formatServiceTarget(
        "postgresql://postgres:postgres@127.0.0.1:5432/trading_analyst",
      ),
    ).toBe("127.0.0.1:5432");
    expect(formatServiceTarget("redis://127.0.0.1:6379")).toBe(
      "127.0.0.1:6379",
    );
  });

  it("builds a developer-friendly Redis connection failure message", () => {
    const error = Object.assign(
      new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      {
        code: "ECONNREFUSED",
      },
    );

    expect(
      formatInfrastructureCheckFailure("Redis", "127.0.0.1:6379", error),
    ).toMatchObject({
      hint: "Start Redis or Docker Compose, then retry the worker and API.",
      message:
        "Redis is not reachable at 127.0.0.1:6379. The worker will keep logging connection errors until Redis is available.",
      target: "127.0.0.1:6379",
    });
  });
});
