import { loadWebEnv } from "../env";
import { InfrastructureStatusCard } from "./infrastructure-status-card";

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

export default function HomePage() {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sprint 1-5 Foundation</p>
        <h1>Crypto Analyst Foundation</h1>
        <p className="lede">
          The repo currently covers the foundation, shared contracts, crypto
          market-data baseline, persisted indicator snapshots, and persisted
          deterministic signal aggregation. AI analysis, alerting, positions,
          and chat-layer delivery still come in later sprints.
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
          <p>
            Signal snapshot:{" "}
            {apiBaseUrl
              ? `${apiBaseUrl}/signal-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=1H`
              : "Requires API base URL"}
          </p>
        </article>

        <InfrastructureStatusCard apiBaseUrl={apiBaseUrl} />
      </section>
    </main>
  );
}
