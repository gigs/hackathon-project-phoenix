import type { CustomerData } from "@/lib/types";
import { HealthDot } from "./health-dot";

export function CustomerHeader({ data }: { data: CustomerData }) {
  const totalSlackMsgs = data.slackActivity.channels.reduce(
    (sum, ch) => sum + (ch.messagesLast7d ?? 0),
    0,
  );

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
          <span className="text-xs text-sage-500">
            {data.deals.length} {data.deals.length === 1 ? "deal" : "deals"}
          </span>
        </div>
      </div>

      {/* Right: Quick links */}
      <div className="flex flex-wrap items-center gap-2">
        {data.config.slack_channels.length > 0 && (
          <QuickLink label="Slack" detail={data.config.slack_channels[0]} />
        )}
        {totalSlackMsgs > 0 && (
          <QuickLink label="Activity" detail={`${totalSlackMsgs} msgs/wk`} />
        )}
        {data.config.hubspot_company_record_id && (
          <QuickLink label="HubSpot" detail="Company" />
        )}
        {(data.config.linear_initiatives.length > 0 || data.config.linear_projects.length > 0) && (
          <QuickLink
            label="Linear"
            detail={`${data.config.linear_projects.length + data.config.linear_initiatives.length} projects`}
          />
        )}
      </div>
    </div>
  );
}

function QuickLink({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-sage-100 bg-sage-25 px-2.5 py-1.5 transition hover:border-sage-200 hover:bg-sage-75">
      <div>
        <div className="text-3xs font-semibold uppercase tracking-wider text-sage-500">{label}</div>
        <div className="text-xs text-sage-600">{detail}</div>
      </div>
    </div>
  );
}
