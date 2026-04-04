const stack = [
  "Bun workspaces + Turborepo",
  "Next.js web dashboard",
  "Fastify API",
  "BullMQ worker",
  "Drizzle + PostgreSQL",
  "Redis for queues and coordination",
  "Crypto market-data baseline via Twelve Data",
  "Deterministic indicator engine",
];

export default function HomePage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sprint 1-4 Baseline</p>
        <h1>Crypto Analyst Foundation</h1>
        <p className="lede">
          The repo currently covers the foundation, shared contracts, crypto
          market-data baseline, and persisted indicator snapshots. Signal
          aggregation, AI analysis, alerting, positions, and chat-layer delivery
          still come in later sprints.
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
      </section>
    </main>
  );
}
