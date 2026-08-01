import type { AnalysisOutcome } from "@trading-analyst/shared-types";
import { notFound } from "next/navigation";
import { StateBadge } from "@/components/dashboard/dashboard-primitives";
import { fetchAnalysisOutcomes } from "@/lib/dashboard";
import {
  formatAlertTimestamp,
  formatPercent,
  formatPrice,
} from "@/lib/dashboard-format";
import { loadWebEnv } from "@/lib/env";
import { isSessionAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

function resultLabel(outcome: AnalysisOutcome) {
  if (outcome.status === "pending") {
    return { text: "Pending", tone: "muted" as const };
  }

  if (outcome.status === "skipped") {
    return { text: "Skipped", tone: "muted" as const };
  }

  const directionCorrect = outcome.evaluation?.directionCorrect;

  if (directionCorrect === null || directionCorrect === undefined) {
    return { text: "Inconclusive", tone: "muted" as const };
  }

  return directionCorrect
    ? { text: "Correct", tone: "success" as const }
    : { text: "Wrong", tone: "error" as const };
}

const resultToneClass = {
  success: "text-up",
  error: "text-down",
  muted: "text-muted-foreground",
} as const;

export default async function AdminDecisionsPage() {
  const isAdmin = await isSessionAdmin();

  if (!isAdmin) {
    notFound();
  }

  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const result = await fetchAnalysisOutcomes(apiBaseUrl, { limit: 100 });
  const outcomes = result.data?.outcomes ?? [];

  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <div className="grid gap-1.5">
        <h1 className="m-0 text-[1.35rem] tracking-[-0.01em]">
          AI Decision History
        </h1>
        <p className="m-0 text-[0.9rem] text-muted-foreground">
          Every analyzed case, what the AI said, and whether it turned out to be
          right — for reviewing patterns in what works and what doesn't.
        </p>
      </div>

      {outcomes.length === 0 ? (
        <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h3]:m-0 [&_h3]:text-[0.95rem] [&_p]:m-0 [&_p]:text-ink-2">
          <h3>No decisions recorded yet</h3>
          <p>{result.message}</p>
          {result.issues.map((issue) => (
            <p key={issue} className="text-[0.85rem] text-muted-foreground">
              {issue}
            </p>
          ))}
        </article>
      ) : (
        <div className="grid gap-3">
          {outcomes.map((outcome) => {
            const outcomeResult = resultLabel(outcome);

            return (
              <details
                key={outcome.id}
                className="group grid gap-3 rounded-(--radius) border border-border bg-card p-4.5 open:pb-4.5 [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StateBadge state={outcome.state} />
                    <strong className="text-[0.92rem]">
                      {outcome.assetId}
                    </strong>
                    <span className="text-[0.8rem] text-muted-foreground">
                      {outcome.timeframe} ·{" "}
                      {formatAlertTimestamp(outcome.analysisGeneratedAt)}
                    </span>
                  </div>
                  <span
                    className={`text-[0.85rem] font-semibold ${resultToneClass[outcomeResult.tone]}`}
                  >
                    {outcomeResult.text}
                  </span>
                </summary>

                <div className="grid gap-2.5 border-t border-border pt-3.5 text-[0.88rem]">
                  {outcome.summary ? (
                    <p className="m-0 leading-[1.6] text-foreground">
                      {outcome.summary}
                    </p>
                  ) : (
                    <p className="m-0 text-muted-foreground italic">
                      No summary recorded for this decision (recorded before
                      history capture was added).
                    </p>
                  )}

                  {outcome.keyReasons.length > 0 ? (
                    <ul className="m-0 grid gap-1 pl-4.5 text-ink-2">
                      {outcome.keyReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-2">
                    <div className="grid gap-0.5">
                      <span className="text-[0.72rem] text-muted-foreground uppercase">
                        Suggestion
                      </span>
                      <strong>{outcome.suggestion.replaceAll("_", " ")}</strong>
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-[0.72rem] text-muted-foreground uppercase">
                        AI confidence
                      </span>
                      <strong>{outcome.aiConfidence}/100</strong>
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-[0.72rem] text-muted-foreground uppercase">
                        Price at analysis
                      </span>
                      <strong>{formatPrice(outcome.priceAtAnalysis)}</strong>
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-[0.72rem] text-muted-foreground uppercase">
                        Price change
                      </span>
                      <strong>
                        {outcome.evaluation
                          ? formatPercent(outcome.evaluation.priceChangePercent)
                          : "Not yet evaluated"}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-muted-foreground">
                    <span>Model: {outcome.modelUsed}</span>
                    <span>Prompt: {outcome.promptVersion}</span>
                    {outcome.evaluation?.invalidationHit !== undefined &&
                    outcome.evaluation?.invalidationHit !== null ? (
                      <span>
                        Invalidation{" "}
                        {outcome.evaluation.invalidationHit
                          ? "was hit"
                          : "held"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </main>
  );
}
