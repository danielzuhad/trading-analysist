import { describe, expect, it } from "vitest";
import { parseServiceHeartbeat } from "./service-heartbeats.js";

describe("service heartbeat parsing", () => {
  it("normalizes a stored heartbeat row into the shared shape", () => {
    expect(
      parseServiceHeartbeat({
        checkedAt: new Date("2026-04-20T08:00:00.000Z"),
        id: "heartbeat-1",
        payload: {
          detail: "Provider timeout",
        },
        serviceName: "provider:coingecko",
        status: "down",
      }),
    ).toEqual({
      checkedAt: "2026-04-20T08:00:00.000Z",
      payload: {
        detail: "Provider timeout",
      },
      serviceName: "provider:coingecko",
      status: "down",
    });
  });
});
