import type { Alert } from "@trading-analyst/shared-types";
import { formatRelativeTime } from "./dashboard-format";

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
    <article className="card">
      <div className="card-heading">
        <h2>{title}</h2>
        <span className="inline-chip">{alerts.length}</span>
      </div>

      {alerts.length === 0 ? (
        <>
          <p>{message}</p>
          <p className="issue-text">{emptyMessage}</p>
        </>
      ) : (
        <div className="alert-feed">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className={`alert-row alert-row--${mapSeverityClass(alert.severity)}`}
            >
              <div className="alert-row__header">
                <strong>{alert.title}</strong>
                <span className="alert-row__meta">
                  {formatRelativeTime(alert.createdAt)}
                </span>
              </div>

              <p>{alert.summary}</p>

              <div className="alert-row__meta">
                <span className="alert-transition">
                  {alert.previousState ? (
                    <>
                      {alert.previousState.replaceAll("_", " ")}
                      <span className="alert-transition__arrow">→</span>
                    </>
                  ) : null}
                  {alert.currentState.replaceAll("_", " ")}
                </span>
                <span className="inline-chip">{alert.timeframe}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {issues.map((issue) => (
        <p key={issue} className="issue-text">
          {issue}
        </p>
      ))}
    </article>
  );
}
