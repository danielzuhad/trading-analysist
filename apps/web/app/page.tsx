const stack = [
  "Bun workspaces + Turborepo",
  "Next.js web dashboard",
  "Fastify API",
  "BullMQ worker",
  "Drizzle + PostgreSQL",
  "Redis for queues and coordination",
];

export default function HomePage() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sprint 1</p>
        <h1>Trading Analyst Foundation</h1>
        <p className="lede">
          The monorepo, API, worker, web app, and infrastructure scaffolding are
          in place. Domain logic starts in Sprint 2.
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
          <p>API base URL: {apiBaseUrl}</p>
          <p>Health endpoint: {apiBaseUrl}/health</p>
          <p>Readiness endpoint: {apiBaseUrl}/readyz</p>
        </article>
      </section>
    </main>
  );
}
