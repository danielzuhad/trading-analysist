"use client";

import { useEffect, useState } from "react";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
  type InfrastructureStatus,
} from "../status";
import { formatRelativeTime } from "./dashboard-format";

type InfrastructureStatusCardProps = {
  apiBaseUrl: string | undefined;
};

export function InfrastructureStatusCard({
  apiBaseUrl,
}: InfrastructureStatusCardProps) {
  const [infrastructureStatus, setInfrastructureStatus] =
    useState<InfrastructureStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      const nextStatus = await fetchInfrastructureStatus(apiBaseUrl);

      if (!cancelled) {
        setInfrastructureStatus(nextStatus);
      }
    }

    setInfrastructureStatus(null);
    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  if (infrastructureStatus === null) {
    return (
      <details className="status-strip">
        <summary>
          <span className="status-dot status-dot--unknown" />
          Checking system status…
        </summary>
      </details>
    );
  }

  const aiWarning = buildAiOperationalWarning(infrastructureStatus);
  const tone =
    infrastructureStatus.status === "ready"
      ? "ok"
      : infrastructureStatus.status === "degraded"
        ? "warn"
        : "down";

  return (
    <details className="status-strip">
      <summary>
        <span className={`status-dot status-dot--${tone}`} />
        System status: {infrastructureStatus.status}
      </summary>
      <div className="status-strip__body">
        <p>{infrastructureStatus.message}</p>
        {aiWarning ? <p>AI: {aiWarning.title}</p> : null}
        {infrastructureStatus.checks ? (
          <>
            <p>
              PostgreSQL:{" "}
              {infrastructureStatus.checks.database.ok
                ? "reachable"
                : infrastructureStatus.checks.database.message}
            </p>
            <p>
              Redis:{" "}
              {infrastructureStatus.checks.redis.ok
                ? "reachable"
                : infrastructureStatus.checks.redis.message}
            </p>
            {infrastructureStatus.checks.redis.hint ? (
              <p>{infrastructureStatus.checks.redis.hint}</p>
            ) : null}
          </>
        ) : null}
        {infrastructureStatus.issues.map((issue) => (
          <p key={issue}>{issue}</p>
        ))}
        {infrastructureStatus.operational ? (
          <>
            <p>
              AI budget:{" "}
              <span
                className={`status-badge status-badge--${mapAiStateToTone(
                  infrastructureStatus.operational.ai.currentState,
                )}`}
              >
                {infrastructureStatus.operational.ai.currentState}
              </span>
            </p>
            {infrastructureStatus.operational.ai.detail ? (
              <p>{infrastructureStatus.operational.ai.detail}</p>
            ) : null}
            {infrastructureStatus.operational.ai.checkedAt ? (
              <p>
                Last worker heartbeat:{" "}
                {formatRelativeTime(
                  infrastructureStatus.operational.ai.checkedAt,
                )}
              </p>
            ) : null}
            {Object.entries(infrastructureStatus.operational.providers).length >
            0 ? (
              <div className="status-provider-list">
                {Object.entries(infrastructureStatus.operational.providers).map(
                  ([provider, status]) => (
                    <p key={provider}>
                      {provider}:{" "}
                      <span
                        className={`status-badge status-badge--${status.status}`}
                      >
                        {status.status}
                      </span>
                      {status.detail ? ` (${status.detail})` : ""}
                    </p>
                  ),
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}

function mapAiStateToTone(
  state:
    | "cap-reached"
    | "disabled"
    | "error"
    | "ok"
    | "quota-exceeded"
    | "unknown",
) {
  if (state === "ok") {
    return "active";
  }

  if (state === "disabled") {
    return "disabled";
  }

  if (state === "cap-reached" || state === "unknown") {
    return "degraded";
  }

  return "down";
}
