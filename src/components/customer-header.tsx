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

export function CustomerHeader({ data }: { data: CustomerData }) {
  const totalSlackMsgs = data.slackActivity.channels.reduce(
    (sum, ch) => sum + (ch.messagesLast7d ?? 0),
    0,
  );

  const initiativeSlug = data.config.linear_initiatives[0];
  const hubspotUrl = data.config.hubspot_company_record_id
    ? hubspotCompanyUrl(data.config.hubspot_company_record_id)
    : null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-sage-200 bg-white px-6 py-4">
      {/* Left: Customer identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-central-200 text-base font-bold text-central-800">
          {data.config.name[0]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-sage-950">{data.config.name}</h1>
            <HealthDot status={data.health} showLabel />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sage-500">
              {data.deals.length} {data.deals.length === 1 ? "deal" : "deals"}
            </span>
            {data.driName && (
              <span className="flex items-center gap-1.5 text-xs text-sage-500">
                <span className="text-sage-300">·</span>
                {data.driAvatarUrl ? (
                  <img src={data.driAvatarUrl} alt={data.driName} className="h-5 w-5 rounded-full" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-central-100 text-3xs font-semibold text-central-700">
                    {data.driName.split(/\s+/).map(w => w[0]).join("").slice(0, 2)}
                  </span>
                )}
                {data.driName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Quick links as icon buttons */}
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
