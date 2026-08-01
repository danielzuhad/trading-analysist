import type {
  AssetState,
  OverviewStatus,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import { cva } from "class-variance-authority";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatMissingDataLabel,
  formatPercent,
  formatScore,
  mapAssetStateClass,
  mapDeltaClass,
  mapOverviewStatusTone,
  mapScoreClass,
} from "@/lib/dashboard-format";
import { cn } from "@/lib/utils";

type DashboardTimeframeTabsProps = {
  basePath: string;
  timeframe: SupportedTimeframe;
};

type Tone = "active" | "degraded" | "disabled" | "down";

export function DashboardTimeframeTabs({
  basePath,
  timeframe,
}: DashboardTimeframeTabsProps) {
  const timeframes: SupportedTimeframe[] = ["1H", "4H"];

  return (
    <nav
      className="inline-flex gap-0.75 rounded-full border border-border bg-card p-0.75"
      aria-label="Timeframe selector"
    >
      {timeframes.map((entry) => (
        <Link
          key={entry}
          className={cn(
            "inline-flex min-h-7.5 items-center justify-center rounded-full px-4 text-[0.85rem] font-semibold text-muted-foreground hover:text-foreground",
            entry === timeframe && "bg-primary text-white hover:text-white",
          )}
          href={`${basePath}?timeframe=${entry}`}
        >
          {entry}
        </Link>
      ))}
    </nav>
  );
}

const badgeBaseClasses =
  "inline-flex min-h-6.5 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[0.74rem] font-bold tracking-[0.06em] uppercase";

const stateBadgeVariants = cva(badgeBaseClasses, {
  variants: {
    tone: {
      none: "bg-muted-foreground/16 text-muted-foreground",
      ignore: "bg-muted-foreground/16 text-muted-foreground",
      watch: "bg-accent-soft text-accent",
      prepare: "bg-warn-soft text-[#e8a93a]",
      actionable: "bg-up-soft text-up",
      "in-position": "bg-violet-soft text-violet",
      "exit-warning": "bg-orange-soft text-orange",
      invalid: "bg-red-soft text-down",
    },
  },
  defaultVariants: {
    tone: "none",
  },
});

export function StateBadge({ state }: { state: AssetState | undefined }) {
  return (
    <span className={stateBadgeVariants({ tone: mapAssetStateClass(state) })}>
      {state?.replaceAll("_", " ") ?? "No AI state"}
    </span>
  );
}

export const statusBadgeVariants = cva(badgeBaseClasses, {
  variants: {
    tone: {
      active: "bg-up-soft text-up",
      degraded: "bg-warn-soft text-[#e8a93a]",
      down: "bg-red-soft text-down",
      disabled: "bg-muted-foreground/16 text-muted-foreground",
    },
  },
  defaultVariants: {
    tone: "disabled",
  },
});

export function OverviewStatusBadge({ status }: { status: OverviewStatus }) {
  return <ToneBadge tone={mapOverviewStatusTone(status)}>{status}</ToneBadge>;
}

const deltaVariants = cva("text-[0.95rem] font-semibold tabular-nums", {
  variants: {
    tone: {
      up: "text-up",
      down: "text-down",
      flat: "text-muted-foreground",
    },
  },
  defaultVariants: {
    tone: "flat",
  },
});

export function DeltaText({ value }: { value?: number | undefined }) {
  return (
    <span className={deltaVariants({ tone: mapDeltaClass(value) })}>
      {value === undefined ? "—" : formatPercent(value)}
    </span>
  );
}

const scoreBarFillVariants = cva("h-full rounded-full", {
  variants: {
    tone: {
      high: "bg-up",
      mid: "bg-warn",
      low: "bg-down",
      none: "bg-muted-foreground",
    },
  },
  defaultVariants: {
    tone: "none",
  },
});

export function ScoreBar({
  label,
  value,
}: {
  label: string;
  value?: number | undefined;
}) {
  const clamped =
    value === undefined ? 0 : Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="grid gap-1.25">
      <span className="flex justify-between text-[0.78rem] tracking-[0.08em] text-muted-foreground uppercase">
        {label}
        <strong className="tracking-normal text-foreground tabular-nums">
          {value === undefined ? "—" : formatScore(value)}
        </strong>
      </span>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-secondary"
        aria-hidden="true"
      >
        <div
          className={scoreBarFillVariants({ tone: mapScoreClass(value) })}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function InfoPill({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string | undefined;
  title?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground",
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}

export function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value?: string | number | undefined;
  valueClass?: string | undefined;
}) {
  return (
    <p className="m-0 flex justify-between gap-3 text-[0.9rem] text-ink-2 [&>span:first-child]:text-muted-foreground [&>span:last-child]:text-right [&>span:last-child]:tabular-nums [&>span:last-child]:text-foreground">
      <span>{label}</span>
      <span className={valueClass}>{value ?? "—"}</span>
    </p>
  );
}

export function MissingDataList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground"
        >
          {formatMissingDataLabel(item)}
        </span>
      ))}
    </div>
  );
}

function ToneBadge({ children, tone }: { children: ReactNode; tone: Tone }) {
  return <span className={statusBadgeVariants({ tone })}>{children}</span>;
}
