import type { PortfolioOverviewResponse } from "@trading-analyst/shared-types";
import { formatPrice } from "@/lib/dashboard-format";

type PortfolioOverviewCardProps = {
  data: PortfolioOverviewResponse | null;
  issues: string[];
  message: string;
};

export function PortfolioOverviewCard({
  data,
  issues,
  message,
}: PortfolioOverviewCardProps) {
  return (
    <article className="card">
      <div className="card-heading">
        <h2>Portfolio</h2>
        {data ? (
          <span className="inline-chip">{data.openPositionCount} open</span>
        ) : null}
      </div>

      {!data || data.openPositionCount === 0 ? (
        <>
          <p>{message}</p>
          {issues.map((issue) => (
            <p key={issue} className="issue-text">
              {issue}
            </p>
          ))}
        </>
      ) : (
        <div className="portfolio-overview">
          <div className="portfolio-overview__totals">
            <div className="portfolio-overview__stat">
              <span className="portfolio-overview__stat-label">
                Total exposure
              </span>
              <strong>{formatPrice(data.totalNotionalValue)}</strong>
            </div>
            <div className="portfolio-overview__stat">
              <span className="portfolio-overview__stat-label">
                Unrealized P&L
              </span>
              <strong
                className={`delta delta--${data.totalUnrealizedPnl >= 0 ? "up" : "down"}`}
              >
                {formatPrice(data.totalUnrealizedPnl)}
              </strong>
            </div>
          </div>

          <div className="portfolio-overview__exposure-bar" aria-hidden="true">
            <div
              className="portfolio-overview__exposure-bar-fill portfolio-overview__exposure-bar-fill--long"
              style={{ width: `${data.longExposurePercent}%` }}
            />
            <div
              className="portfolio-overview__exposure-bar-fill portfolio-overview__exposure-bar-fill--short"
              style={{ width: `${data.shortExposurePercent}%` }}
            />
          </div>
          <div className="portfolio-overview__exposure-legend">
            <span>Long {Math.round(data.longExposurePercent)}%</span>
            <span>Short {Math.round(data.shortExposurePercent)}%</span>
          </div>

          {data.concentrationWarnings.length > 0 ? (
            <div className="portfolio-overview__warnings">
              {data.concentrationWarnings.map((warning) => (
                <p
                  key={`${warning.kind}:${warning.message}`}
                  className="portfolio-overview__warning"
                >
                  {warning.message}
                </p>
              ))}
            </div>
          ) : null}

          <ul className="portfolio-overview__positions">
            {data.positions.map((position) => (
              <li key={position.positionId}>
                <span className="portfolio-overview__position-symbol">
                  {position.asset.symbol}
                  <span
                    className={`inline-chip portfolio-overview__direction portfolio-overview__direction--${position.direction}`}
                  >
                    {position.direction}
                  </span>
                </span>
                <span className="portfolio-overview__position-value">
                  {formatPrice(position.notionalValue)}
                  {position.unrealizedPnl !== undefined ? (
                    <span
                      className={`delta delta--${position.unrealizedPnl >= 0 ? "up" : "down"}`}
                    >
                      {formatPrice(position.unrealizedPnl)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
