import type { SignalAggregationSnapshot } from "@trading-analyst/shared-types";
import {
  aiAnalysisEngineOutputSchema,
  assetStates,
  riskLevelValues,
  suggestedPositionSizeValues,
} from "@trading-analyst/shared-types";
import type {
  AiAnalysisProvider,
  AiAnalysisProviderResult,
} from "./analysis.js";
import {
  buildAiAnalysisPrompt,
  defaultAiAnalysisModel,
  defaultAiAnalysisPromptVersion,
  resolveAllowedSuggestionValues,
} from "./analysis.js";

type OpenAiResponseContent =
  | {
      refusal: string;
      type: "refusal";
    }
  | {
      text: string;
      type: "output_text";
    };

type OpenAiResponsesApiResponse = {
  model?: string;
  output?: Array<{
    content?: OpenAiResponseContent[];
    role?: string;
    type?: string;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
    };
    output_tokens?: number;
  };
};

type OpenAiAnalysisErrorDetails = {
  responseBody?: string;
  statusCode?: number;
};

type ResponseLike = Pick<Response, "json" | "ok" | "status"> &
  Partial<Pick<Response, "text">>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<ResponseLike>;

export class OpenAiAnalysisError extends Error {
  readonly details: OpenAiAnalysisErrorDetails | undefined;

  constructor(message: string, details?: OpenAiAnalysisErrorDetails) {
    super(message);
    this.name = "OpenAiAnalysisError";
    this.details = details;
  }
}

type CreateOpenAiAnalysisProviderOptions = {
  apiKey: string;
  apiUrl?: string;
  fetchImpl?: FetchLike;
  model?: string;
  promptVersion?: string;
};

export function createOpenAiAnalysisProvider({
  apiKey,
  apiUrl = "https://api.openai.com/v1/responses",
  fetchImpl = fetch,
  model: defaultModel = defaultAiAnalysisModel,
  promptVersion: defaultPromptVersion = defaultAiAnalysisPromptVersion,
}: CreateOpenAiAnalysisProviderOptions): AiAnalysisProvider {
  return async ({
    model = defaultModel,
    promptVersion = defaultPromptVersion,
    signalSnapshot,
  }) =>
    requestOpenAiAnalysis({
      apiKey,
      apiUrl,
      fetchImpl,
      model,
      promptVersion,
      signalSnapshot,
    });
}

export async function requestOpenAiAnalysis({
  apiKey,
  apiUrl = "https://api.openai.com/v1/responses",
  fetchImpl = fetch,
  model = defaultAiAnalysisModel,
  promptVersion = defaultAiAnalysisPromptVersion,
  signalSnapshot,
}: {
  apiKey: string;
  apiUrl?: string;
  fetchImpl?: FetchLike;
  model?: string;
  promptVersion?: string;
  signalSnapshot: SignalAggregationSnapshot;
}): Promise<AiAnalysisProviderResult> {
  const prompt = buildAiAnalysisPrompt({
    promptVersion,
    signalSnapshot,
  });
  const requestBody = buildOpenAiAnalysisRequestBody({
    model,
    signalSnapshot,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
  });
  const startedAt = Date.now();
  const response = await fetchImpl(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    const responseBody = await readResponseBody(response);

    throw new OpenAiAnalysisError(
      `OpenAI Responses API request failed with status ${response.status}.`,
      {
        ...(responseBody ? { responseBody } : {}),
        statusCode: response.status,
      },
    );
  }

  const payload = (await response.json()) as OpenAiResponsesApiResponse;
  const refusal = extractRefusal(payload);

  if (refusal) {
    throw new OpenAiAnalysisError(`OpenAI refused the analysis: ${refusal}`);
  }

  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new OpenAiAnalysisError("OpenAI returned no structured output text.");
  }

  return {
    aiLatencyMs: latencyMs,
    metadata: {
      usage: payload.usage ?? {},
    },
    modelUsed: payload.model ?? model,
    output: parseOpenAiAnalysisOutput(outputText),
    usage: {
      cachedInputTokens:
        payload.usage?.input_tokens_details?.cached_tokens ?? 0,
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
    },
  };
}

export function buildOpenAiAnalysisRequestBody({
  model,
  signalSnapshot,
  systemPrompt,
  userPrompt,
}: {
  model: string;
  signalSnapshot: SignalAggregationSnapshot;
  systemPrompt: string;
  userPrompt: string;
}) {
  return {
    model,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "asset_analysis_engine_output",
        schema: buildOpenAiAnalysisJsonSchema(signalSnapshot),
        strict: true,
      },
    },
  };
}

export function buildOpenAiAnalysisJsonSchema(
  signalSnapshot: SignalAggregationSnapshot,
) {
  return {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: assetStates,
      },
      suggestion: {
        type: "string",
        enum: resolveAllowedSuggestionValues(signalSnapshot),
      },
      summary: {
        type: "string",
      },
      keyReasons: {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
      },
      concerns: {
        type: "array",
        items: {
          type: "string",
        },
      },
      actionPlan: {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
      },
      executionMethod: {
        type: "string",
      },
      invalidation: {
        type: "string",
      },
      riskLevel: {
        type: "string",
        enum: riskLevelValues,
      },
      suggestedPositionSize: {
        type: "string",
        enum: suggestedPositionSizeValues,
      },
      aiConfidence: {
        type: "integer",
        minimum: 0,
        maximum: 100,
      },
      notes: {
        type: ["string", "null"],
      },
    },
    required: [
      "state",
      "suggestion",
      "summary",
      "keyReasons",
      "concerns",
      "actionPlan",
      "executionMethod",
      "invalidation",
      "riskLevel",
      "suggestedPositionSize",
      "aiConfidence",
      "notes",
    ],
    additionalProperties: false,
  };
}

export function parseOpenAiAnalysisOutput(outputText: string) {
  const parsed = normalizeOpenAiAnalysisOutput(JSON.parse(outputText));

  return aiAnalysisEngineOutputSchema.parse(parsed);
}

function normalizeOpenAiAnalysisOutput(value: unknown) {
  if (typeof value !== "object" || value === null || !("notes" in value)) {
    return value;
  }

  const output = { ...value } as Record<string, unknown>;

  if (output.notes === null) {
    delete output.notes;
  }

  if (typeof output.notes === "string" && output.notes.trim().length === 0) {
    delete output.notes;
  }

  return output;
}

function extractOutputText(response: OpenAiResponsesApiResponse) {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text") {
        return content.text;
      }
    }
  }

  return null;
}

function extractRefusal(response: OpenAiResponsesApiResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        return content.refusal;
      }
    }
  }

  return null;
}

async function readResponseBody(response: ResponseLike) {
  if (typeof response.text === "function") {
    return truncateResponseBody(await response.text());
  }

  try {
    return truncateResponseBody(JSON.stringify(await response.json()));
  } catch {
    return undefined;
  }
}

function truncateResponseBody(value: string) {
  const normalized = value.trim();

  if (normalized.length <= 1_000) {
    return normalized;
  }

  return `${normalized.slice(0, 1_000)}...`;
}
