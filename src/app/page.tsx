import { loadPortfolio } from "@/lib/data-loader";
import { MOCK_PORTFOLIO } from "@/lib/mock-data";
import { PortfolioTable } from "@/components/portfolio-table";

export default function PortfolioPage() {
  const portfolio = loadPortfolio();
  const data = portfolio.length > 0 ? portfolio : MOCK_PORTFOLIO;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-sage-500">
          Portfolio overview — {data.length} customers
        </p>
      </div>
      <PortfolioTable entries={data} />
    </div>
  );
}
