import { loadWebEnv } from "../env";
import { loadInfrastructureStatus } from "../status";

export const dynamic = "force-dynamic";

const stack = [
  "Bun workspaces + Turborepo",
  "Next.js web dashboard",
  "Fastify API",
  "BullMQ worker",
  "Drizzle + PostgreSQL",
  "Redis for queues and coordination",
  "Crypto market-data baseline via Twelve Data",
  "Deterministic indicator engine",
  "Deterministic signal aggregation",
];

export default async function HomePage() {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const infrastructureStatus = await loadInfrastructureStatus(apiBaseUrl);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sprint 1-5 Foundation</p>
        <h1>Crypto Analyst Foundation</h1>
        <p className="lede">
          The repo currently covers the foundation, shared contracts, crypto
          market-data baseline, persisted indicator snapshots, and deterministic
          signal aggregation. AI analysis, alerting, positions, and chat-layer
          delivery still come in later sprints.
        </p>
      </section>

      <section className="card-grid">
        <article className="card">
          <h2>Workspace</h2>
          <ul>
            {stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Service Endpoints</h2>
          <p>API base URL: {apiBaseUrl ?? "Set NEXT_PUBLIC_API_BASE_URL"}</p>
          <p>
            Health endpoint:{" "}
            {apiBaseUrl ? `${apiBaseUrl}/health` : "Requires API base URL"}
          </p>
          <p>
            Readiness endpoint:{" "}
            {apiBaseUrl ? `${apiBaseUrl}/readyz` : "Requires API base URL"}
          </p>
          <p>
            Market snapshot:{" "}
            {apiBaseUrl
              ? `${apiBaseUrl}/market-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H`
              : "Requires API base URL"}
          </p>
          <p>
            Indicator snapshot:{" "}
            {apiBaseUrl
              ? `${apiBaseUrl}/indicator-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H`
              : "Requires API base URL"}
          </p>
        </article>

        <article className="card">
          <h2>Infrastructure Status</h2>
          <p>Status: {infrastructureStatus.status}</p>
          <p>{infrastructureStatus.message}</p>
          {infrastructureStatus.checks ? (
            <>
              <p>
                PostgreSQL:{" "}
                {infrastructureStatus.checks.database.ok
                  ? `reachable${infrastructureStatus.checks.database.target ? ` at ${infrastructureStatus.checks.database.target}` : ""}`
                  : infrastructureStatus.checks.database.message}
              </p>
              <p>
                Redis:{" "}
                {infrastructureStatus.checks.redis.ok
                  ? `reachable${infrastructureStatus.checks.redis.target ? ` at ${infrastructureStatus.checks.redis.target}` : ""}`
                  : infrastructureStatus.checks.redis.message}
              </p>
              {infrastructureStatus.checks.redis.hint ? (
                <p>Worker note: {infrastructureStatus.checks.redis.hint}</p>
              ) : null}
            </>
          ) : null}
          {infrastructureStatus.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </article>
      </section>
    </main>
  );
}
