import { cva } from "class-variance-authority";
import {
  formatPercent,
  formatPrice,
  getInvalidationStatus,
} from "@/lib/dashboard-format";

const bannerVariants = cva(
  "flex flex-wrap items-center justify-between gap-2.5 rounded-sm border p-3",
  {
    variants: {
      status: {
        breached: "border-down/40 bg-red-soft",
        approaching: "border-warn/40 bg-warn-soft",
        safe: "border-border bg-secondary",
      },
    },
  },
);

const labelText = {
  breached: "Invalidation breached",
  approaching: "Approaching invalidation",
  safe: "Invalidation intact",
} as const;

const dotVariants = cva("h-2.5 w-2.5 shrink-0 rounded-full", {
  variants: {
    status: {
      breached: "bg-down",
      approaching: "bg-warn",
      safe: "bg-up",
    },
  },
});

export function InvalidationStatus({
  invalidation,
  price,
}: {
  invalidation?: number | undefined;
  price?: number | undefined;
}) {
  const status = getInvalidationStatus(price, invalidation);

  if (!status || price === undefined || invalidation === undefined) {
    return null;
  }

  const distancePercent = ((invalidation - price) / price) * 100;

  return (
    <div className={bannerVariants({ status })} role="status">
      <span className="flex items-center gap-2.5">
        <span className={dotVariants({ status })} aria-hidden="true" />
        <strong className="text-[0.92rem] font-semibold text-foreground">
          {labelText[status]}
        </strong>
      </span>
      <span className="text-[0.85rem] tabular-nums text-ink-2">
        Level {formatPrice(invalidation)}
        {status === "breached" ? null : (
          <> · {formatPercent(distancePercent)} away</>
        )}
      </span>
    </div>
  );
}
