import { PortfolioOverviewCard } from "@/components/dashboard/portfolio-overview-card";
import { fetchPortfolioOverview } from "@/lib/dashboard";
import { loadWebEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const portfolioResult = await fetchPortfolioOverview(apiBaseUrl);

  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <h1 className="m-0 text-[1.35rem] tracking-[-0.01em]">Portfolio</h1>

      <div className="max-w-md">
        <PortfolioOverviewCard
          data={portfolioResult.data}
          issues={portfolioResult.issues}
          message={portfolioResult.message}
        />
      </div>
    </main>
  );
}
