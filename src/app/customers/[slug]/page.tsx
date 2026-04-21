import { loadCustomerData, getAvailableCustomerSlugs } from "@/lib/data-loader";
import { getCustomerSlugs } from "@/lib/customer-loader";
import { MOCK_KLARNA, MOCK_REVOLUT, MOCK_SANTANDER } from "@/lib/mock-data";
import { CustomerHeader } from "@/components/customer-header";
import { TimelineChart } from "@/components/timeline-chart";
import { DealsTable } from "@/components/deals-table";
import type { CustomerData } from "@/lib/types";

const MOCK_MAP: Record<string, CustomerData> = {
  klarna: MOCK_KLARNA,
  revolut: MOCK_REVOLUT,
  santander: MOCK_SANTANDER,
};

export function generateStaticParams() {
  const dataSlugs = getAvailableCustomerSlugs();
  const configSlugs = getCustomerSlugs();
  const slugs = dataSlugs.length > 0 ? dataSlugs : configSlugs;
  return slugs.map((slug) => ({ slug }));
}

/**
 * Merge fetched data with mock data — use fetched values when present,
 * fall back to mock for fields that are empty/missing.
 */
function mergeWithMock(fetched: CustomerData | null, mock: CustomerData | undefined): CustomerData | null {
  if (!fetched && !mock) return null;
  if (!fetched) return mock ?? null;
  if (!mock) return fetched;

  return {
    ...fetched,
    // Use fetched deals if they have real data (hubspot stages etc), else mock
    deals: fetched.deals.some((d) => d.hubspotStage !== null) ? fetched.deals : mock.deals,
    // Use fetched ARR if non-empty, else mock
    arrData: fetched.arrData.length > 0 ? fetched.arrData : mock.arrData,
    // Use fetched milestones if non-empty, else mock
    milestones: (fetched.milestones ?? []).length > 0 ? fetched.milestones : mock.milestones,
    // Use fetched issues if non-empty, else mock
    linearIssues: fetched.linearIssues.length > 0 ? fetched.linearIssues : mock.linearIssues,
    // Use fetched health if not gray (i.e. real data), else mock
    health: fetched.health !== "gray" ? fetched.health : mock.health,
  };
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fetched = loadCustomerData(slug);
  const mock = MOCK_MAP[slug];
  const data = mergeWithMock(fetched, mock);

  if (!data) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-sage-900">Customer not found</h1>
        <p className="mt-2 text-sm text-sage-500">
          No data available for &ldquo;{slug}&rdquo;
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <CustomerHeader data={data} />

      {/* Full-width timeline: ARR + Forecast + Milestones */}
      <div className="mt-4">
        <TimelineChart arrData={data.arrData} milestones={data.milestones} deals={data.deals} />
      </div>

      {/* Deals table with inline issues */}
      <div className="mt-4">
        <DealsTable deals={data.deals} customerName={data.config.name} issues={data.linearIssues} />
      </div>

      <footer className="mt-4 py-3 text-center text-xs text-sage-400">
        Last updated: {new Date(data.lastUpdated).toLocaleString()} — Phoenix v0.1
      </footer>
    </div>
  );
}
