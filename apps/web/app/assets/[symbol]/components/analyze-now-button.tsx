"use client";

import type { SupportedTimeframe } from "@trading-analyst/shared-types";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { requestAnalysisAction } from "@/lib/analysis-actions";

type AnalyzeNowButtonProps = {
  assetId: string;
  symbol: string;
  timeframe: SupportedTimeframe;
};

export function AnalyzeNowButton({
  assetId,
  symbol,
  timeframe,
}: AnalyzeNowButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    startTransition(async () => {
      const result = await requestAnalysisAction(assetId, timeframe, symbol);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="cursor-pointer rounded-full border border-input bg-secondary px-3 py-1 text-[0.78rem] font-semibold whitespace-nowrap text-muted-foreground hover:border-accent hover:bg-accent-soft hover:text-accent disabled:cursor-wait disabled:opacity-60"
      disabled={isPending}
      onClick={handleAnalyze}
      title={`Run a fresh AI analysis for ${symbol} ${timeframe} now. This spends one AI call.`}
    >
      {isPending ? "Queueing…" : "Analyze now"}
    </button>
  );
}
