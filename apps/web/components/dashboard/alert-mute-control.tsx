"use client";

import { isAlertsMuted } from "@trading-analyst/shared-types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/dashboard-format";
import { setWatchlistAlertsMuteAction } from "@/lib/watchlist-actions";

type AlertMuteControlProps = {
  alertsMutedUntil: string | undefined;
  assetId: string;
};

const muteDurations = [
  { hours: 4, label: "4h" },
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
];

const controlClassName =
  "cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 text-[0.8rem] text-muted-foreground disabled:cursor-wait disabled:opacity-60";

export function AlertMuteControl({
  alertsMutedUntil,
  assetId,
}: AlertMuteControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedHours, setSelectedHours] = useState(24);
  const muted = isAlertsMuted({
    ...(alertsMutedUntil ? { alertsMutedUntil } : {}),
  });

  function handleMuteChange(muteAlertsForHours: number | null) {
    startTransition(async () => {
      const result = await setWatchlistAlertsMuteAction(
        assetId,
        muteAlertsForHours,
      );

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  if (muted) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[0.8rem] text-muted-foreground">
          Alerts muted · resumes {formatRelativeTime(alertsMutedUntil)}
        </span>
        <button
          type="button"
          className={`${controlClassName} hover:border-accent hover:text-accent`}
          disabled={isPending}
          onClick={() => handleMuteChange(null)}
        >
          Unmute
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Mute duration"
        className="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 text-[0.8rem] text-muted-foreground"
        disabled={isPending}
        onChange={(event) => setSelectedHours(Number(event.target.value))}
        value={selectedHours}
      >
        {muteDurations.map((duration) => (
          <option key={duration.hours} value={duration.hours}>
            {duration.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`${controlClassName} hover:border-warn/50 hover:text-warn`}
        disabled={isPending}
        onClick={() => handleMuteChange(selectedHours)}
        title="Stop Telegram delivery for this asset. Alerts still appear in the dashboard feed."
      >
        Mute alerts
      </button>
    </div>
  );
}
