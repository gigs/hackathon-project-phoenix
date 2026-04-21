import { getAvailableCustomerSlugs, loadAccountBrief, loadPortfolio } from "@/lib/data-loader";
import { MOCK_PORTFOLIO } from "@/lib/mock-data";
import { PortfolioTable } from "@/components/portfolio-table";
import { PortfolioSummaryStrip } from "@/components/portfolio-summary-strip";

export default function PortfolioPage() {
  const portfolio = loadPortfolio();
  const data = portfolio.length > 0 ? portfolio : MOCK_PORTFOLIO;
  const accountBriefs = Object.fromEntries(
    getAvailableCustomerSlugs().map((slug) => [slug, loadAccountBrief(slug)]),
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sage-950">Customers</h1>
        <p className="mt-1 text-sm text-sage-500">
          Portfolio overview — {data.length} customers
        </p>
      </div>
      <PortfolioSummaryStrip entries={data} accountBriefs={accountBriefs} />
      <PortfolioTable entries={data} />
    </div>
  );
}
