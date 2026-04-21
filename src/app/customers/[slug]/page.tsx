import { loadCustomerData, getAvailableCustomerSlugs } from "@/lib/data-loader";
import { getCustomerSlugs } from "@/lib/customer-loader";
import { MOCK_KLARNA, MOCK_REVOLUT, MOCK_SANTANDER } from "@/lib/mock-data";
import { CustomerPageClient } from "./client";
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

function mergeWithMock(fetched: CustomerData | null, mock: CustomerData | undefined): CustomerData | null {
  if (!fetched && !mock) return null;
  if (!fetched) return mock ?? null;
  if (!mock) return fetched;

  return {
    ...fetched,
    deals: fetched.deals.some((d) => d.hubspotStage !== null) ? fetched.deals : mock.deals,
    arrData: fetched.arrData.length > 0 ? fetched.arrData : mock.arrData,
    milestones: (fetched.milestones ?? []).length > 0 ? fetched.milestones : mock.milestones,
    linearIssues: fetched.linearIssues.length > 0 ? fetched.linearIssues : mock.linearIssues,
    health: fetched.health !== "gray" ? fetched.health : mock.health,
    driName: fetched.driName ?? mock.driName,
    driAvatarUrl: fetched.driAvatarUrl ?? mock.driAvatarUrl,
    healthHistory: (fetched.healthHistory ?? []).length > 0 ? fetched.healthHistory : mock.healthHistory,
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

  return <CustomerPageClient data={data} />;
}
