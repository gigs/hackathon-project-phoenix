"use client";

import { useState } from "react";
import { CustomerHeader } from "@/components/customer-header";
import { DealFilter } from "@/components/deal-filter";
import { TimelineChart } from "@/components/timeline-chart";
import { DealsTable } from "@/components/deals-table";
import { HexEmbeds } from "@/components/hex-embeds";
import { ChatWidget } from "@/components/chat-widget";
import type {
  AccountBriefPayload,
  CustomerData,
  OverallSentimentPayload,
  SlackInsightPayload,
  TimelineMetric,
} from "@/lib/types";
import { OverallSentimentPanel } from "@/components/overall-sentiment-panel";
import { SlackInsightPanel } from "@/components/slack-insight-panel";

export function CustomerPageClient({
  data,
  slackInsight,
  overallSentiment,
  accountBrief,
}: {
  data: CustomerData;
  slackInsight: SlackInsightPayload | null;
  overallSentiment: OverallSentimentPayload | null;
  accountBrief: AccountBriefPayload;
}) {
  const [activeDeal, setActiveDeal] = useState<string | null>(null);
  const [metric, setMetric] = useState<TimelineMetric>("arr");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-6 pb-32">
      <CustomerHeader
        data={data}
        actions={
          <ChatWidget
            customerName={data.config.name}
            data={data}
            brief={accountBrief}
            slackInsight={slackInsight}
            overallSentiment={overallSentiment}
            variant="inline"
          />
        }
      />

      <div className="space-y-4">
        <DealFilter
          deals={data.deals}
          activeDeal={activeDeal}
          onSelect={setActiveDeal}
          metric={metric}
          onMetricChange={setMetric}
        />
        <TimelineChart
          arrActuals={data.arrActuals}
          forecast={data.forecast}
          config={data.config}
          milestones={data.milestones}
          deals={data.deals}
          activeDeal={activeDeal}
          healthHistory={data.healthHistory}
          metric={metric}
        />
      </div>

      <DealsTable
        deals={data.deals}
        customerName={data.config.name}
        issues={data.linearIssues}
        activeDeal={activeDeal}
      />

      {overallSentiment ? <OverallSentimentPanel sentiment={overallSentiment} /> : null}

      {data.config.hex_embeds && data.config.hex_embeds.length > 0 && (
        <HexEmbeds embeds={data.config.hex_embeds} />
      )}

      {slackInsight ? <SlackInsightPanel insight={slackInsight} /> : null}

      <footer className="py-3 text-center text-xs text-sage-400">
        Last updated: {new Date(data.lastUpdated).toLocaleString()} — Phoenix v0.1
      </footer>
    </div>
  );
}
