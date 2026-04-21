import type { CustomerData } from "@/lib/types";
import { HealthDot } from "./health-dot";

const LINEAR_ORG = process.env.NEXT_PUBLIC_LINEAR_ORG_SLUG ?? "gigs";
const HUBSPOT_PORTAL = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "";

function slackUrl(channel: string) {
  return `https://slack.com/app_redirect?channel=${channel.replace(/^#/, "")}`;
}

function hubspotCompanyUrl(companyId: string) {
  if (!HUBSPOT_PORTAL) return null;
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/company/${companyId}`;
}

function linearInitiativeUrl(slug: string) {
  return `https://linear.app/${LINEAR_ORG}/initiative/${slug}`;
}

export function CustomerHeader({
  data,
  actions,
}: {
  data: CustomerData;
  actions?: React.ReactNode;
}) {
  const initiativeSlug = data.config.linear_initiatives[0];
  const hubspotUrl = data.config.hubspot_company_record_id
    ? hubspotCompanyUrl(data.config.hubspot_company_record_id)
    : null;
  const updated = new Date(data.lastUpdated).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="rounded-xl border border-sage-200 bg-white px-6 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">
            Customers / {data.config.name}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-central-200 text-lg font-bold text-central-900">
              {data.config.name[0]}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-3xl font-bold tracking-tight text-sage-950">
                  {data.config.name}
                </h1>
                <HealthDot status={data.health} showLabel />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MetaPill label={`${data.deals.length} ${data.deals.length === 1 ? "deal" : "deals"}`} />
                {data.driName ? <MetaPill label={`DRI: ${data.driName}`} /> : null}
                <MetaPill label={`Updated ${updated}`} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          {actions}
          <div className="flex items-center gap-1.5">
            {data.config.slack_channels.length > 0 && (
              <IconLink
                href={slackUrl(data.config.slack_channels[0])}
                title={`Slack: ${data.config.slack_channels[0]}`}
                icon="/slack.svg"
              />
            )}
            {data.config.hubspot_company_record_id && (
              <IconLink
                href={hubspotUrl ?? undefined}
                title="Open in HubSpot"
                icon="/hubspot-icon.svg"
              />
            )}
            {initiativeSlug && (
              <IconLink
                href={linearInitiativeUrl(initiativeSlug)}
                title="Open in Linear"
                icon="/linear-logo.svg"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-sage-200 bg-sage-50 px-2.5 py-1 text-xs font-medium text-sage-600">
      {label}
    </span>
  );
}

function IconLink({ href, title, icon }: { href?: string; title: string; icon: string }) {
  const classes =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-sage-100 bg-sage-25 transition hover:border-sage-200 hover:bg-sage-75";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} title={title}>
        <img src={icon} alt={title} className="h-4 w-4" />
      </a>
    );
  }

  return (
    <div className={classes} title={title}>
      <img src={icon} alt={title} className="h-4 w-4" />
    </div>
  );
}
