import { formatPrice } from "@/lib/dashboard-format";

export function LevelBar({
  invalidation,
  price,
  resistance,
  support,
}: {
  invalidation?: number | undefined;
  price?: number | undefined;
  resistance?: number | undefined;
  support?: number | undefined;
}) {
  const values = [support, resistance, invalidation, price].filter(
    (value): value is number => value !== undefined,
  );

  if (price === undefined || values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || max * 0.01 || 1) * 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const position = (value: number) => ((value - lo) / (hi - lo)) * 100;

  return (
    <div className="grid gap-2">
      <div className="relative h-2 rounded-full bg-secondary">
        {support !== undefined ? (
          <span
            className="absolute top-1/2 h-4 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-up"
            style={{ left: `${position(support)}%` }}
            title={`Support ${formatPrice(support)}`}
          />
        ) : null}
        {resistance !== undefined ? (
          <span
            className="absolute top-1/2 h-4 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-accent"
            style={{ left: `${position(resistance)}%` }}
            title={`Resistance ${formatPrice(resistance)}`}
          />
        ) : null}
        {invalidation !== undefined ? (
          <span
            className="absolute top-1/2 h-4 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-down"
            style={{ left: `${position(invalidation)}%` }}
            title={`Invalidation ${formatPrice(invalidation)}`}
          />
        ) : null}
        <span
          className="absolute top-1/2 h-2.75 w-2.75 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
          style={{ left: `${position(price)}%` }}
          title={`Price ${formatPrice(price)}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8rem] tabular-nums text-muted-foreground">
        {support !== undefined ? (
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-up not-italic" />
            Support {formatPrice(support)}
          </span>
        ) : null}
        {resistance !== undefined ? (
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-accent not-italic" />
            Resistance {formatPrice(resistance)}
          </span>
        ) : null}
        {invalidation !== undefined ? (
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-down not-italic" />
            Invalidation {formatPrice(invalidation)}
          </span>
        ) : null}
        <span>
          <i className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-foreground not-italic" />
          Price {formatPrice(price)}
        </span>
      </div>
    </div>
  );
}
