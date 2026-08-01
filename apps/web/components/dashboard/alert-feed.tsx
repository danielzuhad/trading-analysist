import type { Alert } from "@trading-analyst/shared-types";
import { InfoPill } from "@/components/dashboard/dashboard-primitives";
import { formatRelativeTime } from "@/lib/dashboard-format";
import { cn } from "@/lib/utils";

type AlertFeedProps = {
  alerts: Alert[];
  emptyMessage: string;
  issues?: string[];
  message: string;
  title: string;
};

function mapSeverityClass(severity: Alert["severity"]) {
  if (severity === "critical") {
    return "critical";
  }

  if (severity === "warning") {
    return "warning";
  }

  return "info";
}

export function AlertFeed({
  alerts,
  emptyMessage,
  issues = [],
  message,
  title,
}: AlertFeedProps) {
  return (
    <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base [&_p]:m-0 [&_p]:text-ink-2">
      <div className="flex items-start justify-between gap-3">
        <h2>{title}</h2>
        <InfoPill>{alerts.length}</InfoPill>
      </div>

      {alerts.length === 0 ? (
        <>
          <p>{message}</p>
          <p className="text-[0.85rem] text-muted-foreground">{emptyMessage}</p>
        </>
      ) : (
        <div className="grid gap-2.5">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className={cn(
                "grid gap-2 rounded-sm border border-border border-l-3 bg-secondary p-3.5",
                mapSeverityClass(alert.severity) === "critical" &&
                  "border-l-down",
                mapSeverityClass(alert.severity) === "warning" &&
                  "border-l-warn",
                mapSeverityClass(alert.severity) === "info" &&
                  "border-l-accent",
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <strong className="text-[0.92rem] leading-[1.4]">
                  {alert.title}
                </strong>
                <span className="flex flex-wrap items-center gap-2 text-[0.8rem] text-muted-foreground">
                  {formatRelativeTime(alert.createdAt)}
                </span>
              </div>

              <p>{alert.summary}</p>

              <div className="flex flex-wrap items-center gap-2 text-[0.8rem] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  {alert.previousState ? (
                    <>
                      {alert.previousState.replaceAll("_", " ")}
                      <span className="text-muted-foreground">→</span>
                    </>
                  ) : null}
                  {alert.currentState.replaceAll("_", " ")}
                </span>
                <InfoPill>{alert.timeframe}</InfoPill>
              </div>
            </article>
          ))}
        </div>
      )}

      {issues.map((issue) => (
        <p key={issue} className="text-[0.85rem] text-muted-foreground">
          {issue}
        </p>
      ))}
    </article>
  );
}
