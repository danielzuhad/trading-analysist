import { cva } from "class-variance-authority";
import { InfoPill } from "@/components/dashboard/dashboard-primitives";
import { formatRelativeTime } from "@/lib/dashboard-format";
import type { AiOperationalWarning } from "@/lib/status";

const bannerVariants = cva("grid gap-2 rounded-(--radius) border p-3.5 px-4", {
  variants: {
    tone: {
      critical: "border-red/40 bg-red-soft",
      warning: "border-warn/40 bg-warn-soft",
    },
  },
});

export function OperationalWarningBanner({
  warning,
}: {
  warning: AiOperationalWarning;
}) {
  return (
    <section
      aria-live="polite"
      className={bannerVariants({ tone: warning.tone })}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">
            Operational warning
          </p>
          <h2 className="m-0 text-[0.98rem]">{warning.title}</h2>
        </div>
        <InfoPill>{warning.statusLabel}</InfoPill>
      </div>
      <p className="m-0 text-[0.9rem] text-ink-2">{warning.message}</p>
      {warning.detail ? (
        <p className="m-0 text-[0.9rem] text-ink-2">{warning.detail}</p>
      ) : null}
      {warning.checkedAt ? (
        <p className="text-[0.8rem] text-muted-foreground">
          Last worker update: {formatRelativeTime(warning.checkedAt)}
        </p>
      ) : null}
    </section>
  );
}
