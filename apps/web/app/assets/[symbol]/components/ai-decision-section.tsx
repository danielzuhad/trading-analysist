import type { AssetOverviewResponse } from "@trading-analyst/shared-types";
import {
  InfoPill,
  MissingDataList,
  ScoreBar,
  StateBadge,
} from "@/components/dashboard/dashboard-primitives";
import { formatRelativeTime } from "@/lib/dashboard-format";
import { AnalyzeNowButton } from "./analyze-now-button";
import { InvalidationStatus } from "./invalidation-status";
import { LevelBar } from "./level-bar";

const decisionCardClassName =
  "grid gap-1.5 rounded-sm border border-border bg-secondary p-3.5 [&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:leading-[1.6] [&_p]:text-ink-2 [&_ul]:m-0 [&_ul]:pl-4.5 [&_ul]:text-[0.9rem] [&_ul]:leading-[1.6] [&_ul]:text-ink-2";

const decisionCardLabelClassName =
  "text-[0.72rem] tracking-widest text-muted-foreground uppercase";

export function AiDecisionSection({
  overview,
}: {
  overview: AssetOverviewResponse;
}) {
  const analysis = overview.analysisSnapshot;
  const decision = analysis?.decisionCard;

  return (
    <section
      className="grid gap-4 rounded-(--radius) border border-input bg-card p-5"
      aria-label="AI decision"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-base">AI Decision</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <AnalyzeNowButton
            assetId={overview.asset.id}
            symbol={overview.asset.symbol}
            timeframe={overview.timeframe}
          />
          {analysis?.suggestion ? (
            <InfoPill>{analysis.suggestion.replaceAll("_", " ")}</InfoPill>
          ) : null}
          <StateBadge state={analysis?.state} />
        </div>
      </div>

      <p className="m-0 text-[1.02rem] leading-[1.6] text-foreground">
        {analysis?.summary ??
          "No AI analysis has been stored for this asset and timeframe yet."}
      </p>

      <InvalidationStatus
        invalidation={analysis?.keyLevels.invalidation}
        price={overview.marketSnapshot?.lastPrice}
      />

      <LevelBar
        invalidation={analysis?.keyLevels.invalidation}
        price={overview.marketSnapshot?.lastPrice}
        resistance={analysis?.keyLevels.nearestResistance}
        support={analysis?.keyLevels.nearestSupport}
      />

      {decision ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
          <div className={decisionCardClassName}>
            <span className={decisionCardLabelClassName}>Action plan</span>
            <ul>
              {decision.actionPlan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <div className={`${decisionCardClassName} border-down/35`}>
            <span className={decisionCardLabelClassName}>Invalidation</span>
            <p>{decision.invalidation}</p>
          </div>
          <div className={decisionCardClassName}>
            <span className={decisionCardLabelClassName}>Key reasons</span>
            <ul>
              {decision.keyReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className={decisionCardClassName}>
            <span className={decisionCardLabelClassName}>
              Concerns · risk {decision.riskLevel}
            </span>
            {analysis?.concerns.length ? (
              <ul>
                {analysis.concerns.map((concern) => (
                  <li key={concern}>{concern}</li>
                ))}
              </ul>
            ) : (
              <p>No concerns recorded.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2.5">
        <ScoreBar
          label="Signal"
          value={overview.signalSnapshot?.signalStrengthScore}
        />
        <ScoreBar label="AI confidence" value={analysis?.aiConfidence} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <InfoPill>{analysis?.modelUsed ?? "no model"}</InfoPill>
        <InfoPill>
          Generated {formatRelativeTime(analysis?.generatedAt)}
        </InfoPill>
        {analysis?.suggestedPositionSize ? (
          <InfoPill>Size: {analysis.suggestedPositionSize}</InfoPill>
        ) : null}
      </div>
      <MissingDataList items={overview.missingData} />
    </section>
  );
}
