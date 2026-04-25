import type { Alert } from "@trading-analyst/shared-types";
import { describe, expect, it } from "vitest";
import { parseAlert, serializeAlert } from "./alerts.js";

const alertFixture: Alert = {
  id: "alert:crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h",
  userId: "system:default",
  assetId: "crypto:global:BTC-USD",
  analysisId: "analysis:latest:crypto:global:BTC-USD:4H",
  transitionId:
    "transition:crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h",
  timeframe: "4H",
  dedupeKey: "crypto:global:BTC-USD:4H:WATCH->ACTIONABLE:signal-hash-btc-4h",
  kind: "market",
  severity: "critical",
  status: "suggested",
  channels: ["dashboard"],
  title: "BTC/USD actionable setup",
  message:
    "BTC/USD changed from WATCH to ACTIONABLE. Trend remains constructive.",
  summary: "Trend remains constructive.",
  previousState: "WATCH",
  currentState: "ACTIONABLE",
  suggestion: "ENTRY_ON_CONFIRMATION",
  createdAt: "2026-04-21T08:05:00.000Z",
  isStale: false,
  metadata: {
    aiConfidence: 78,
    signalStrengthScore: 82,
  },
};

describe("alert persistence", () => {
  it("serializes and parses alert records", () => {
    const serialized = serializeAlert(alertFixture);
    const parsed = parseAlert({
      ...serialized,
      acknowledgedAt: serialized.acknowledgedAt ?? null,
      analysisId: serialized.analysisId ?? null,
      createdAt: new Date(alertFixture.createdAt),
      deliveredAt: serialized.deliveredAt ?? null,
      expiresAt: serialized.expiresAt ?? null,
      isStale: serialized.isStale ?? false,
      positionId: serialized.positionId ?? null,
      previousState: serialized.previousState ?? null,
      suggestion: serialized.suggestion ?? null,
      transitionId: serialized.transitionId ?? null,
      updatedAt: new Date(alertFixture.createdAt),
      watchlistId: serialized.watchlistId ?? null,
    });

    expect(serialized.dedupeKey).toBe(alertFixture.dedupeKey);
    expect(parsed).toEqual(alertFixture);
  });
});
