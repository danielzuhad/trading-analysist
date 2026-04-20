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
  "Private/internal crypto MVP",
  "BTC/ETH/SOL on 4H operational loop",
  "CoinGecko market data + context",
  "Bybit + Fear & Greed context",
  "Deterministic indicator engine",
  "Deterministic signal aggregation",
  "AI analysis with confidence clamp and cost cap",
  "Context-provider status transparency",
];

export default function HomePage() {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sprint 7 Validation</p>
        <h1>4H Crypto Analyst Loop</h1>
        <p className="lede">
          The repo now centers on an internal BTC/ETH/SOL loop: CoinGecko market
          data, indicators, signal snapshots, AI analysis, and provider-health
          visibility. Alerting, positions, and chat-layer delivery still remain
          later sprint work.
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
              ? `${apiBaseUrl}/market-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=4H`
              : "Requires API base URL"}
          </p>
          <p>
            Indicator snapshot:{" "}
            {apiBaseUrl
              ? `${apiBaseUrl}/indicator-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=4H`
              : "Requires API base URL"}
          </p>
          <p>
            Signal snapshot:{" "}
            {apiBaseUrl
              ? `${apiBaseUrl}/signal-snapshots/latest?assetId=crypto:global:BTC-USD&timeframe=4H`
              : "Requires API base URL"}
          </p>
          <p>
            Asset analysis:{" "}
            {apiBaseUrl
              ? `${apiBaseUrl}/asset-analyses/latest?assetId=crypto:global:BTC-USD&timeframe=4H`
              : "Requires API base URL"}
          </p>
        </article>

        <InfrastructureStatusCard apiBaseUrl={apiBaseUrl} />
      </section>
    </main>
  );
}
