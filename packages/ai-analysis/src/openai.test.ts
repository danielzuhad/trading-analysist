import { describe, expect, it, vi } from "vitest";
import {
  buildOpenAiAnalysisJsonSchema,
  createOpenAiAnalysisProvider,
  OpenAiAnalysisError,
} from "./openai.js";
import {
  createAiOutputFixture,
  createSignalSnapshotFixture,
} from "./test-fixtures.js";

describe("OpenAI analysis adapter", () => {
  it("builds a watchlist-only suggestion schema when there is no position", () => {
    const schema = buildOpenAiAnalysisJsonSchema(createSignalSnapshotFixture());

    expect(schema.properties.suggestion.enum).toEqual([
      "NO_TRADE",
      "WATCH",
      "WAIT",
      "ENTRY_ON_CONFIRMATION",
      "ENTRY_SMALL",
    ]);
  });

  it("builds a position-management suggestion schema when a position exists", () => {
    const snapshot = createSignalSnapshotFixture();
    snapshot.position = {
      id: "position-btc-open",
      userId: "user-123",
      assetId: snapshot.asset.id,
      direction: "long",
      status: "open",
      entryPrice: 83200,
      averageEntryPrice: 83200,
      quantity: 1,
      remainingQuantity: 1,
      takeProfitLevels: [],
      openedAt: "2026-04-19T07:00:00.000Z",
      lastUpdatedAt: "2026-04-19T08:00:00.000Z",
      isBackfilled: false,
      metadata: {},
    };
    const schema = buildOpenAiAnalysisJsonSchema(snapshot);

    expect(schema.properties.suggestion.enum).toEqual([
      "HOLD",
      "HOLD_TIGHT",
      "REDUCE_RISK",
      "TAKE_PARTIAL_PROFIT",
      "EXIT_IF_BREAKS_LEVEL",
      "EXIT_NOW",
    ]);
  });

  it("parses a structured Responses API payload", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: "gpt-4o-mini-2024-07-18",
        output_text: JSON.stringify(createAiOutputFixture()),
        usage: {
          input_tokens: 1234,
          input_tokens_details: {
            cached_tokens: 234,
          },
          output_tokens: 321,
        },
      }),
    }));
    const provider = createOpenAiAnalysisProvider({
      apiKey: "test-key",
      fetchImpl: fetchMock,
    });

    const result = await provider({
      model: "gpt-4o-mini",
      promptVersion: "ai-analysis:v1",
      signalSnapshot: createSignalSnapshotFixture(),
    });

    expect(result.output.state).toBe("ACTIONABLE");
    expect(result.modelUsed).toBe("gpt-4o-mini-2024-07-18");
    expect(result.usage).toEqual({
      cachedInputTokens: 234,
      inputTokens: 1234,
      outputTokens: 321,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when OpenAI refuses the request", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        output: [
          {
            content: [
              {
                refusal: "I cannot help with that request.",
                type: "refusal",
              },
            ],
          },
        ],
      }),
    }));
    const provider = createOpenAiAnalysisProvider({
      apiKey: "test-key",
      fetchImpl: fetchMock,
    });

    await expect(
      provider({
        model: "gpt-4o-mini",
        promptVersion: "ai-analysis:v1",
        signalSnapshot: createSignalSnapshotFixture(),
      }),
    ).rejects.toBeInstanceOf(OpenAiAnalysisError);
  });
});
