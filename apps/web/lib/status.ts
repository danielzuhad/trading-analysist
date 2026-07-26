export type ReadinessCheck = {
  hint?: string;
  message?: string;
  ok: boolean;
  target?: string;
};

export type ProviderOperationalStatus = {
  checkedAt?: string;
  detail?: string;
  latencyMs?: number;
  status: "active" | "degraded" | "down" | "disabled";
};

export type AiOperationalStatus = {
  checkedAt?: string;
  currentState:
    | "cap-reached"
    | "disabled"
    | "error"
    | "ok"
    | "quota-exceeded"
    | "unknown";
  detail?: string;
  maxDailyAiCostUsd?: number;
};

export type AiOperationalWarning = {
  checkedAt?: string;
  detail?: string;
  message: string;
  statusLabel: string;
  title: string;
  tone: "critical" | "warning";
};

export type ReadyzPayload = {
  checks: {
    database: ReadinessCheck;
    redis: ReadinessCheck;
  };
  issues: string[];
  operational?: {
    ai: AiOperationalStatus;
    providers: Record<string, ProviderOperationalStatus>;
  };
  service: "api";
  status: "degraded" | "ready";
  timestamp: string;
};

export type InfrastructureStatus = {
  checks: ReadyzPayload["checks"] | null;
  issues: string[];
  message: string;
  operational: ReadyzPayload["operational"] | null;
  status: "api-unconfigured" | "api-unreachable" | "degraded" | "ready";
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "json">>;

export function buildInfrastructureStatus(
  apiBaseUrl: string | undefined,
  readyz: ReadyzPayload | null,
  errorMessage?: string,
): InfrastructureStatus {
  if (!apiBaseUrl) {
    return {
      checks: null,
      issues: [
        "Set NEXT_PUBLIC_API_BASE_URL to enable live infrastructure checks.",
      ],
      message: "API base URL is not configured.",
      operational: null,
      status: "api-unconfigured",
    };
  }

  if (errorMessage) {
    return {
      checks: null,
      issues: [
        "The web app could not reach the API readiness endpoint.",
        "Make sure the API is running on the configured host and port.",
      ],
      message: `API readiness request failed: ${errorMessage}`,
      operational: null,
      status: "api-unreachable",
    };
  }

  if (!readyz) {
    return {
      checks: null,
      issues: ["The API readiness response was empty."],
      message: "API readiness information is unavailable.",
      operational: null,
      status: "api-unreachable",
    };
  }

  return {
    checks: readyz.checks,
    issues: readyz.issues,
    message:
      readyz.status === "ready"
        ? "API, PostgreSQL, and Redis are reachable."
        : "The API is running, but one or more infrastructure dependencies are degraded.",
    operational: readyz.operational ?? null,
    status: readyz.status,
  };
}

export async function fetchInfrastructureStatus(
  apiBaseUrl: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<InfrastructureStatus> {
  if (!apiBaseUrl) {
    return buildInfrastructureStatus(undefined, null);
  }

  try {
    const response = await fetchImpl(`${apiBaseUrl}/readyz`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as ReadyzPayload;

    return buildInfrastructureStatus(apiBaseUrl, payload);
  } catch (error) {
    return buildInfrastructureStatus(
      apiBaseUrl,
      null,
      error instanceof Error ? error.message : "Unknown readiness error",
    );
  }
}

export function buildAiOperationalWarning(
  infrastructureStatus: Pick<InfrastructureStatus, "operational">,
): AiOperationalWarning | null {
  const ai = infrastructureStatus.operational?.ai;

  if (!ai) {
    return null;
  }

  if (ai.currentState === "quota-exceeded") {
    return {
      message:
        "New AI analyses are blocked until the OpenAI project has available credits or active billing again.",
      statusLabel: "Quota exceeded",
      title: "OpenAI credits need attention",
      tone: "critical",
      ...(ai.checkedAt ? { checkedAt: ai.checkedAt } : {}),
      ...(ai.detail ? { detail: ai.detail } : {}),
    };
  }

  if (ai.currentState === "error") {
    return {
      message:
        "The latest AI analysis request failed. Check worker logs and the OpenAI project status before rerunning the loop.",
      statusLabel: "AI error",
      title: "AI analysis is failing",
      tone: "critical",
      ...(ai.checkedAt ? { checkedAt: ai.checkedAt } : {}),
      ...(ai.detail ? { detail: ai.detail } : {}),
    };
  }

  if (ai.currentState === "cap-reached") {
    return {
      message:
        ai.maxDailyAiCostUsd !== undefined
          ? `The configured daily AI cap of $${ai.maxDailyAiCostUsd.toFixed(2)} is blocking non-critical re-analysis.`
          : "The configured daily AI cap is blocking non-critical re-analysis.",
      statusLabel: "Daily cap reached",
      title: "AI cost cap is active",
      tone: "warning",
      ...(ai.checkedAt ? { checkedAt: ai.checkedAt } : {}),
      ...(ai.detail ? { detail: ai.detail } : {}),
    };
  }

  if (ai.currentState === "disabled") {
    return {
      message:
        "AI analysis is turned off for the worker environment until OPENAI_API_KEY is configured again.",
      statusLabel: "AI disabled",
      title: "AI analysis is disabled",
      tone: "warning",
      ...(ai.checkedAt ? { checkedAt: ai.checkedAt } : {}),
      ...(ai.detail ? { detail: ai.detail } : {}),
    };
  }

  return null;
}
