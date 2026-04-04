export type ReadinessCheck = {
  hint?: string;
  message?: string;
  ok: boolean;
  target?: string;
};

export type ReadyzPayload = {
  checks: {
    database: ReadinessCheck;
    redis: ReadinessCheck;
  };
  issues: string[];
  service: "api";
  status: "degraded" | "ready";
  timestamp: string;
};

export type InfrastructureStatus = {
  checks: ReadyzPayload["checks"] | null;
  issues: string[];
  message: string;
  status: "api-unconfigured" | "api-unreachable" | "degraded" | "ready";
};

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
      status: "api-unreachable",
    };
  }

  if (!readyz) {
    return {
      checks: null,
      issues: ["The API readiness response was empty."],
      message: "API readiness information is unavailable.",
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
    status: readyz.status,
  };
}

export async function loadInfrastructureStatus(
  apiBaseUrl: string | undefined,
): Promise<InfrastructureStatus> {
  if (!apiBaseUrl) {
    return buildInfrastructureStatus(undefined, null);
  }

  try {
    const response = await fetch(`${apiBaseUrl}/readyz`, {
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
