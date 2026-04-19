import { describe, expect, it } from "vitest";
import {
  analyzeSignalSnapshot,
  buildLatestAssetAnalysis,
  clampAiConfidence,
  estimateAiCostUsd,
  shouldSkipAiAnalysisForDailyCostCap,
} from "./analysis.js";
import {
  createAiOutputFixture,
  createSignalSnapshotFixture,
} from "./test-fixtures.js";

describe("ai analysis domain helpers", () => {
  it("clamps ai confidence to the deterministic signal band", () => {
    expect(clampAiConfidence(99, 70)).toEqual({
      aiConfidence: 90,
      maxAllowed: 90,
      minAllowed: 50,
      originalAiConfidence: 99,
      wasClamped: true,
    });
  });

  it("estimates GPT-4o mini token cost with cached input pricing", () => {
    expect(
      estimateAiCostUsd({
        cachedInputTokens: 200,
        inputTokens: 1200,
        model: "gpt-4o-mini",
        outputTokens: 300,
      }),
    ).toBe(0.000345);
  });

  it("skips non-critical analysis when the daily cap is reached", () => {
    expect(
      shouldSkipAiAnalysisForDailyCostCap({
        currentDailyCostUsd: 2.1,
        maxDailyCostUsd: 2,
        previousState: "WATCH",
      }),
    ).toMatchObject({
      maxDailyCostUsd: 2,
      reason: "daily_cost_cap_reached",
      shouldSkip: true,
    });
  });

  it("keeps critical-state analysis active after the daily cap is reached", () => {
    expect(
      shouldSkipAiAnalysisForDailyCostCap({
        currentDailyCostUsd: 2.1,
        maxDailyCostUsd: 2,
        previousState: "ACTIONABLE",
      }),
    ).toEqual({
      maxDailyCostUsd: 2,
      shouldSkip: false,
    });
  });

  it("builds the persisted latest asset analysis shape from AI output", () => {
    const signalSnapshot = createSignalSnapshotFixture();
    const analysis = buildLatestAssetAnalysis({
      aiLatencyMs: 840,
      aiOutput: createAiOutputFixture({
        aiConfidence: 95,
      }),
      costEstimateUsd: 0.00042,
      generatedAt: "2026-04-19T08:05:00.000Z",
      modelUsed: "gpt-4o-mini",
      signalSnapshot,
      triggeredBy: "manual_recalculation",
    });

    expect(analysis.id).toBe("analysis:latest:crypto:global:BTC-USD:1H");
    expect(analysis.aiConfidence).toBe(95);
    expect(analysis.originalAiConfidence).toBeUndefined();
    expect(analysis.decisionCard.summary).toBe(analysis.summary);
    expect(analysis.metadata.signalAggregationSnapshotId).toBe(
      signalSnapshot.id,
    );
  });

  it("clamps out-of-range model confidence during analysis generation", async () => {
    const signalSnapshot = createSignalSnapshotFixture();
    const provider = async () => ({
      aiLatencyMs: 915,
      modelUsed: "gpt-4o-mini",
      output: createAiOutputFixture({
        aiConfidence: 25,
      }),
      usage: {
        cachedInputTokens: 0,
        inputTokens: 1000,
        outputTokens: 250,
      },
    });

    const result = await analyzeSignalSnapshot({
      provider,
      signalSnapshot,
    });

    if (result.status !== "analyzed") {
      throw new Error("Expected analyzed result.");
    }

    expect(result.analysis.aiConfidence).toBe(62);
    expect(result.analysis.originalAiConfidence).toBe(25);
    expect(result.analysis.metadata.aiConfidenceClampRange).toEqual({
      maxAllowed: 100,
      minAllowed: 62,
    });
  });

  it("returns a skipped result when the daily cap blocks analysis", async () => {
    const provider = async () => {
      throw new Error("provider should not run");
    };

    const result = await analyzeSignalSnapshot({
      currentDailyCostUsd: 2.5,
      maxDailyCostUsd: 2,
      previousState: "WATCH",
      provider,
      signalSnapshot: createSignalSnapshotFixture(),
    });

    expect(result).toEqual({
      currentDailyCostUsd: 2.5,
      maxDailyCostUsd: 2,
      reason: "daily_cost_cap_reached",
      status: "skipped",
    });
  });
});
