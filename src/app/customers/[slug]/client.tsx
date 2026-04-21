"use client";

import { useState } from "react";
import { CustomerHeader } from "@/components/customer-header";
import { DealFilter } from "@/components/deal-filter";
import { TimelineChart } from "@/components/timeline-chart";
import { DealsTable } from "@/components/deals-table";
import { HexEmbeds } from "@/components/hex-embeds";
import { ChatWidget } from "@/components/chat-widget";
import type {
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
}: {
  data: CustomerData;
  slackInsight: SlackInsightPayload | null;
  overallSentiment: OverallSentimentPayload | null;
}) {
  const [activeDeal, setActiveDeal] = useState<string | null>(null);
  const [metric, setMetric] = useState<TimelineMetric>("arr");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 space-y-4">
      <CustomerHeader data={data} />

      {overallSentiment && <OverallSentimentPanel sentiment={overallSentiment} />}

      {slackInsight && <SlackInsightPanel insight={slackInsight} />}

      {/* Deal filter — page-level, controls both timeline and deals table */}
      <DealFilter
        deals={data.deals}
        activeDeal={activeDeal}
        onSelect={setActiveDeal}
        metric={metric}
        onMetricChange={setMetric}
      />

      {/* Full-width timeline: ARR + Forecast + Milestones */}
      <TimelineChart
        arrData={data.arrData}
        milestones={data.milestones}
        deals={data.deals}
        activeDeal={activeDeal}
        healthHistory={data.healthHistory}
        metric={metric}
      />

      {/* Deals table with inline issues */}
      <DealsTable
        deals={data.deals}
        customerName={data.config.name}
        issues={data.linearIssues}
        activeDeal={activeDeal}
      />

      {/* Hex embeds */}
      {data.config.hex_embeds && data.config.hex_embeds.length > 0 && (
        <HexEmbeds embeds={data.config.hex_embeds} />
      )}

      <footer className="py-3 text-center text-xs text-sage-400">
        Last updated: {new Date(data.lastUpdated).toLocaleString()} — Phoenix v0.1
      </footer>

      <ChatWidget customerName={data.config.name} />
    </div>
  );
}
