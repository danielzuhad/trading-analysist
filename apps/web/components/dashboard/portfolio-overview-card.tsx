import type { PortfolioOverviewResponse } from "@trading-analyst/shared-types";
import { InfoPill } from "@/components/dashboard/dashboard-primitives";
import { formatPrice } from "@/lib/dashboard-format";
import { cn } from "@/lib/utils";

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
    <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h2]:m-0 [&_h2]:text-base [&_p]:m-0 [&_p]:text-ink-2">
      <div className="flex items-start justify-between gap-3">
        <h2>Portfolio</h2>
        {data ? <InfoPill>{data.openPositionCount} open</InfoPill> : null}
      </div>

      {!data || data.openPositionCount === 0 ? (
        <>
          <p>{message}</p>
          {issues.map((issue) => (
            <p key={issue} className="text-[0.85rem] text-muted-foreground">
              {issue}
            </p>
          ))}
        </>
      ) : (
        <div className="grid gap-3.5">
          <div className="flex gap-6">
            <div className="grid gap-0.5">
              <span className="text-[0.8rem] text-muted-foreground">
                Total exposure
              </span>
              <strong>{formatPrice(data.totalNotionalValue)}</strong>
            </div>
            <div className="grid gap-0.5">
              <span className="text-[0.8rem] text-muted-foreground">
                Unrealized P&L
              </span>
              <strong
                className={cn(
                  "font-semibold tabular-nums",
                  data.totalUnrealizedPnl >= 0 ? "text-up" : "text-down",
                )}
              >
                {formatPrice(data.totalUnrealizedPnl)}
              </strong>
            </div>
          </div>

          <div
            className="flex h-2 overflow-hidden rounded-full bg-border"
            aria-hidden="true"
          >
            <div
              className="bg-up"
              style={{ width: `${data.longExposurePercent}%` }}
            />
            <div
              className="bg-down"
              style={{ width: `${data.shortExposurePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[0.8rem] text-muted-foreground">
            <span>Long {Math.round(data.longExposurePercent)}%</span>
            <span>Short {Math.round(data.shortExposurePercent)}%</span>
          </div>

          {data.concentrationWarnings.length > 0 ? (
            <div className="grid gap-1.5">
              {data.concentrationWarnings.map((warning) => (
                <p
                  key={`${warning.kind}:${warning.message}`}
                  className="rounded-sm bg-warn-soft px-2.5 py-1.5 text-[0.85rem] text-[#e8a93a]"
                >
                  {warning.message}
                </p>
              ))}
            </div>
          ) : null}

          <ul className="grid gap-2">
            {data.positions.map((position) => (
              <li
                key={position.positionId}
                className="flex items-center justify-between gap-3 text-[0.85rem]"
              >
                <span className="flex items-center gap-2 font-semibold">
                  {position.asset.symbol}
                  <InfoPill
                    className={
                      position.direction === "long" ? "text-up" : "text-down"
                    }
                  >
                    {position.direction}
                  </InfoPill>
                </span>
                <span className="flex items-center gap-2">
                  {formatPrice(position.notionalValue)}
                  {position.unrealizedPnl !== undefined ? (
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        position.unrealizedPnl >= 0 ? "text-up" : "text-down",
                      )}
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
