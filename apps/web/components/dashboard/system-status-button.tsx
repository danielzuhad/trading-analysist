"use client";

import { cva } from "class-variance-authority";
import { useState } from "react";
import { statusBadgeVariants } from "@/components/dashboard/dashboard-primitives";
import {
  ResponsiveSheet,
  useResponsiveSheet,
} from "@/components/responsive-sheet";
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
  initialStatus: InfrastructureStatus;
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

export function SystemStatusButton({
  apiBaseUrl,
  initialStatus,
}: SystemStatusButtonProps) {
  const [infrastructureStatus, setInfrastructureStatus] =
    useState<InfrastructureStatus>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sheet = useResponsiveSheet();

  async function handleOpen() {
    sheet.open();
    setIsRefreshing(true);

    const nextStatus = await fetchInfrastructureStatus(apiBaseUrl);

    setInfrastructureStatus(nextStatus);
    setIsRefreshing(false);
  }

  const tone =
    infrastructureStatus.status === "ready"
      ? "ok"
      : infrastructureStatus.status === "degraded"
        ? "warn"
        : "down";
  const label =
    tone === "ok"
      ? "All systems running"
      : tone === "warn"
        ? "System degraded"
        : "System issue";
  const aiWarning = buildAiOperationalWarning(infrastructureStatus);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-6.5 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground hover:border-input hover:text-ink-2"
        onClick={handleOpen}
      >
        <span className={statusDotVariants({ tone })} />
        {label}
      </button>

      <ResponsiveSheet
        isOpen={sheet.isOpen}
        onOpenChange={sheet.onOpenChange}
        title="System status"
      >
        {isRefreshing ? (
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
                        <span
                          className={statusBadgeVariants({
                            tone: status.status,
                          })}
                        >
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
