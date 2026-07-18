import type { Alert } from "@trading-analyst/shared-types";
import {
  formatAlertStateTransition,
  formatAlertTimestamp,
  mapAlertSeverityTone,
} from "./dashboard-format";

type AlertFeedProps = {
  alerts: Alert[];
  emptyMessage: string;
  issues?: string[];
  message: string;
  title: string;
};

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
        <span className="inline-chip">{alerts.length} item(s)</span>
      </div>

      <p>{message}</p>

      {alerts.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <div className="alert-feed">
          {alerts.map((alert) => (
            <article key={alert.id} className="alert-row">
              <div className="alert-row__header">
                <strong>{alert.title}</strong>
                <span
                  className={`status-badge status-badge--${mapAlertSeverityTone(
                    alert,
                  )}`}
                >
                  {alert.severity}
                </span>
              </div>

              <p>{alert.summary}</p>

              <div className="asset-card__meta">
                <span className="inline-chip">{alert.timeframe}</span>
                <span className="inline-chip">
                  {formatAlertStateTransition(alert)}
                </span>
                <span className="inline-chip">{alert.status}</span>
              </div>

              <p className="alert-row__timestamp">
                {formatAlertTimestamp(alert.createdAt)}
              </p>
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
