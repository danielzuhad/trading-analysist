"use client";

import type { AlertResolution } from "@trading-analyst/shared-types";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { resolveAlertAction } from "@/lib/alert-actions";
import { cn } from "@/lib/utils";

type AlertResolutionActionsProps = {
  alertId: string;
};

const buttonClassName =
  "cursor-pointer rounded-full border border-border bg-transparent px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap text-muted-foreground disabled:cursor-wait disabled:opacity-60";

export function AlertResolutionActions({
  alertId,
}: AlertResolutionActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleResolve(resolution: AlertResolution) {
    startTransition(async () => {
      const result = await resolveAlertAction(alertId, resolution);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={cn(
          buttonClassName,
          "hover:border-accent hover:bg-accent-soft hover:text-accent",
        )}
        disabled={isPending}
        onClick={() => handleResolve("acknowledged")}
        title="Mark as read and acted on"
      >
        Acknowledge
      </button>
      <button
        type="button"
        className={cn(buttonClassName, "hover:border-input hover:text-ink-2")}
        disabled={isPending}
        onClick={() => handleResolve("ignored")}
        title="Dismiss this alert without acting on it"
      >
        Ignore
      </button>
    </div>
  );
}
