import type { AiOperationalWarning } from "../status";

export function OperationalWarningBanner({
  warning,
}: {
  warning: AiOperationalWarning;
}) {
  return (
    <section
      aria-live="polite"
      className={`operational-banner operational-banner--${warning.tone}`}
      role="alert"
    >
      <div className="operational-banner__header">
        <div>
          <p className="operational-banner__eyebrow">Operational warning</p>
          <h2>{warning.title}</h2>
        </div>
        <span className="inline-chip">{warning.statusLabel}</span>
      </div>
      <p>{warning.message}</p>
      {warning.detail ? (
        <p className="operational-banner__detail">{warning.detail}</p>
      ) : null}
      {warning.checkedAt ? (
        <p className="operational-banner__meta">
          Last worker update: {warning.checkedAt}
        </p>
      ) : null}
    </section>
  );
}
