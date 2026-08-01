import type { AnalysisQualityBucket } from "@trading-analyst/shared-types";
import { StateBadge } from "@/components/dashboard/dashboard-primitives";
import { fetchAnalysisQuality } from "@/lib/dashboard";
import { formatWinRate, mapWinRateClass } from "@/lib/dashboard-format";
import { loadWebEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function sumBy(
  buckets: AnalysisQualityBucket[],
  pick: (bucket: AnalysisQualityBucket) => number,
) {
  return buckets.reduce((total, bucket) => total + pick(bucket), 0);
}

function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="grid gap-1 rounded-(--radius) border border-border bg-card p-4.5">
      <span className="text-[0.78rem] tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <strong
        className={`text-[1.8rem] font-bold tabular-nums ${valueClass ?? ""}`}
      >
        {value}
      </strong>
    </div>
  );
}

export default async function TrackRecordPage() {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const result = await fetchAnalysisQuality(apiBaseUrl);
  const data = result.data;
  const buckets = data?.buckets ?? [];

  const directionKnown = sumBy(buckets, (b) => b.directionKnownCount);
  const directionCorrect = sumBy(buckets, (b) => b.directionCorrectCount);
  const invalidationKnown = sumBy(buckets, (b) => b.invalidationKnownCount);
  const invalidationHit = sumBy(buckets, (b) => b.invalidationHitCount);

  // Group by state only for the headline table — model/prompt-version and
  // timeframe splits matter for debugging, not for "is this AI trustworthy",
  // so they're rolled up here and only broken out in the detail table below.
  const byState = new Map<string, AnalysisQualityBucket>();

  for (const bucket of buckets) {
    const existing = byState.get(bucket.state);

    if (!existing) {
      byState.set(bucket.state, { ...bucket });
      continue;
    }

    existing.evaluatedCount += bucket.evaluatedCount;
    existing.directionKnownCount += bucket.directionKnownCount;
    existing.directionCorrectCount += bucket.directionCorrectCount;
    existing.invalidationKnownCount += bucket.invalidationKnownCount;
    existing.invalidationHitCount += bucket.invalidationHitCount;
  }

  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <div className="grid gap-1.5">
        <h1 className="m-0 text-[1.35rem] tracking-[-0.01em]">Track Record</h1>
        <p className="m-0 text-[0.9rem] text-muted-foreground">
          How often this AI's analysis has been right, measured against actual
          price movement — not a claim, a scoreboard.
        </p>
      </div>

      {!data || buckets.length === 0 ? (
        <article className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 [&_h3]:m-0 [&_h3]:text-[0.95rem] [&_p]:m-0 [&_p]:text-ink-2">
          <h3>No evaluated analyses yet</h3>
          <p>
            {result.message} Outcomes are evaluated ~24h after each analysis is
            generated, once enough price history exists to check it.
          </p>
          {result.issues.map((issue) => (
            <p key={issue} className="text-[0.85rem] text-muted-foreground">
              {issue}
            </p>
          ))}
        </article>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3.5 sm:grid-cols-2">
            <StatTile
              label="Direction accuracy"
              value={formatWinRate(directionKnown, directionCorrect)}
              valueClass={mapWinRateClass(directionKnown, directionCorrect)}
            />
            <StatTile
              label="Invalidation hit rate"
              value={formatWinRate(invalidationKnown, invalidationHit)}
              valueClass={mapWinRateClass(invalidationKnown, invalidationHit)}
            />
            <StatTile label="Evaluated" value={String(data.evaluatedCount)} />
            <StatTile label="Pending" value={String(data.pendingCount)} />
          </div>

          <section aria-label="Accuracy by state" className="grid gap-3.5">
            <h2 className="m-0 text-base">By state</h2>
            <div className="overflow-x-auto rounded-(--radius) border border-border bg-card">
              <table className="w-full border-collapse text-[0.88rem]">
                <thead>
                  <tr className="border-b border-border text-left text-[0.74rem] tracking-[0.08em] text-muted-foreground uppercase">
                    <th className="px-4.5 py-3 font-medium">State</th>
                    <th className="px-4.5 py-3 font-medium">Evaluated</th>
                    <th className="px-4.5 py-3 font-medium">
                      Direction accuracy
                    </th>
                    <th className="px-4.5 py-3 font-medium">
                      Invalidation hit rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byState.values()).map((bucket) => (
                    <tr
                      key={bucket.state}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-4.5 py-3">
                        <StateBadge state={bucket.state} />
                      </td>
                      <td className="px-4.5 py-3 tabular-nums text-ink-2">
                        {bucket.evaluatedCount}
                      </td>
                      <td
                        className={`px-4.5 py-3 font-semibold tabular-nums ${mapWinRateClass(bucket.directionKnownCount, bucket.directionCorrectCount)}`}
                      >
                        {formatWinRate(
                          bucket.directionKnownCount,
                          bucket.directionCorrectCount,
                        )}
                        <span className="ml-1.5 text-[0.78rem] font-normal text-muted-foreground">
                          ({bucket.directionCorrectCount}/
                          {bucket.directionKnownCount})
                        </span>
                      </td>
                      <td
                        className={`px-4.5 py-3 font-semibold tabular-nums ${mapWinRateClass(bucket.invalidationKnownCount, bucket.invalidationHitCount)}`}
                      >
                        {formatWinRate(
                          bucket.invalidationKnownCount,
                          bucket.invalidationHitCount,
                        )}
                        <span className="ml-1.5 text-[0.78rem] font-normal text-muted-foreground">
                          ({bucket.invalidationHitCount}/
                          {bucket.invalidationKnownCount})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            aria-label="Accuracy by model, prompt, and timeframe"
            className="grid gap-3.5"
          >
            <h2 className="m-0 text-base">By model and timeframe</h2>
            <div className="overflow-x-auto rounded-(--radius) border border-border bg-card">
              <table className="w-full border-collapse text-[0.85rem]">
                <thead>
                  <tr className="border-b border-border text-left text-[0.74rem] tracking-[0.08em] text-muted-foreground uppercase">
                    <th className="px-4.5 py-3 font-medium">Model</th>
                    <th className="px-4.5 py-3 font-medium">Prompt</th>
                    <th className="px-4.5 py-3 font-medium">Timeframe</th>
                    <th className="px-4.5 py-3 font-medium">State</th>
                    <th className="px-4.5 py-3 font-medium">Evaluated</th>
                    <th className="px-4.5 py-3 font-medium">Direction</th>
                    <th className="px-4.5 py-3 font-medium">Invalidation</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket) => (
                    <tr
                      key={`${bucket.modelUsed}:${bucket.promptVersion}:${bucket.timeframe}:${bucket.state}`}
                      className="border-b border-border text-ink-2 last:border-b-0"
                    >
                      <td className="px-4.5 py-3">{bucket.modelUsed}</td>
                      <td className="px-4.5 py-3 tabular-nums">
                        {bucket.promptVersion}
                      </td>
                      <td className="px-4.5 py-3">{bucket.timeframe}</td>
                      <td className="px-4.5 py-3">
                        <StateBadge state={bucket.state} />
                      </td>
                      <td className="px-4.5 py-3 tabular-nums">
                        {bucket.evaluatedCount}
                      </td>
                      <td className="px-4.5 py-3 tabular-nums">
                        {formatWinRate(
                          bucket.directionKnownCount,
                          bucket.directionCorrectCount,
                        )}
                      </td>
                      <td className="px-4.5 py-3 tabular-nums">
                        {formatWinRate(
                          bucket.invalidationKnownCount,
                          bucket.invalidationHitCount,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
