"use client";

import { useEffect, useState } from "react";
import {
  fetchInfrastructureStatus,
  type InfrastructureStatus,
} from "../status";

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
      <article className="card">
        <h2>Infrastructure Status</h2>
        <p>Status: checking</p>
        <p>Checking live API reachability from the web app.</p>
      </article>
    );
  }

  return (
    <article className="card">
      <h2>Infrastructure Status</h2>
      <p>Status: {infrastructureStatus.status}</p>
      <p>{infrastructureStatus.message}</p>
      {infrastructureStatus.checks ? (
        <>
          <p>
            PostgreSQL:{" "}
            {infrastructureStatus.checks.database.ok
              ? `reachable${infrastructureStatus.checks.database.target ? ` at ${infrastructureStatus.checks.database.target}` : ""}`
              : infrastructureStatus.checks.database.message}
          </p>
          <p>
            Redis:{" "}
            {infrastructureStatus.checks.redis.ok
              ? `reachable${infrastructureStatus.checks.redis.target ? ` at ${infrastructureStatus.checks.redis.target}` : ""}`
              : infrastructureStatus.checks.redis.message}
          </p>
          {infrastructureStatus.checks.redis.hint ? (
            <p>Worker note: {infrastructureStatus.checks.redis.hint}</p>
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
          {Object.entries(infrastructureStatus.operational.providers).length >
          0 ? (
            <div className="status-provider-list">
              {Object.entries(infrastructureStatus.operational.providers).map(
                ([provider, status]) => (
                  <p key={provider}>
                    {provider}:{" "}
                    <span
                      className={`status-badge status-badge--${mapProviderStatusToTone(
                        status.status,
                      )}`}
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
    </article>
  );
}

function mapAiStateToTone(
  state: "cap-reached" | "disabled" | "ok" | "unknown",
) {
  if (state === "ok") {
    return "active";
  }

  if (state === "disabled") {
    return "disabled";
  }

  if (state === "unknown") {
    return "degraded";
  }

  return "down";
}

function mapProviderStatusToTone(
  status: "active" | "degraded" | "down" | "disabled",
) {
  return status;
}
