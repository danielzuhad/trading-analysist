"use client";

import { cva } from "class-variance-authority";
import { useEffect, useState } from "react";
import {
  ResponsiveSheet,
  useResponsiveSheet,
} from "@/components/responsive-sheet";
import { statusBadgeVariants } from "@/components/dashboard/dashboard-primitives";
import { formatRelativeTime } from "@/lib/dashboard-format";
import {
  buildAiOperationalWarning,
  fetchInfrastructureStatus,
  type InfrastructureStatus,
} from "@/lib/status";

const statusDotVariants = cva("h-2.25 w-2.25 shrink-0 rounded-full", {
  variants: {
    tone: {
      ok: "bg-up",
      warn: "bg-warn",
      down: "bg-down",
      unknown: "bg-muted-foreground",
    },
  },
});

type SystemStatusButtonProps = {
  apiBaseUrl: string | undefined;
};

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

export function SystemStatusButton({ apiBaseUrl }: SystemStatusButtonProps) {
  const [infrastructureStatus, setInfrastructureStatus] =
    useState<InfrastructureStatus | null>(null);
  const sheet = useResponsiveSheet();

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

  const tone =
    infrastructureStatus === null
      ? "unknown"
      : infrastructureStatus.status === "ready"
        ? "ok"
        : infrastructureStatus.status === "degraded"
          ? "warn"
          : "down";
  const label =
    infrastructureStatus === null
      ? "Checking system status…"
      : tone === "ok"
        ? "All systems running"
        : tone === "warn"
          ? "System degraded"
          : "System issue";
  const aiWarning = infrastructureStatus
    ? buildAiOperationalWarning(infrastructureStatus)
    : null;

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-6.5 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground hover:border-input hover:text-ink-2"
        onClick={sheet.open}
      >
        <span className={statusDotVariants({ tone })} />
        {label}
      </button>

      <ResponsiveSheet
        isOpen={sheet.isOpen}
        onOpenChange={sheet.onOpenChange}
        title="System status"
      >
        {infrastructureStatus === null ? (
          <p>Checking system status…</p>
        ) : (
          <>
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
                    className={statusBadgeVariants({
                      tone: mapAiStateToTone(
                        infrastructureStatus.operational.ai.currentState,
                      ),
                    })}
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
                {Object.entries(infrastructureStatus.operational.providers)
                  .length > 0 ? (
                  <div className="grid gap-1.5">
                    {Object.entries(
                      infrastructureStatus.operational.providers,
                    ).map(([provider, status]) => (
                      <p key={provider}>
                        {provider}:{" "}
                        <span className={statusBadgeVariants({ tone: status.status })}>
                          {status.status}
                        </span>
                        {status.detail ? ` (${status.detail})` : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ResponsiveSheet>
    </>
  );
}
