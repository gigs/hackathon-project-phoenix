import type {
  AccountBriefPayload,
  CustomerData,
  OverallSentimentPayload,
  SlackInsightPayload,
} from "./types";
import {
  currentArr,
  currentLines,
  formatCurrencyCompact,
  formatNumberCompact,
} from "./customer-intelligence";

export interface AssistantAnswer {
  answer: string;
  citations: { label: string; url: string | null }[];
}

function listDeals(data: CustomerData): string {
  return data.deals
    .map((deal) => `${deal.label} (${deal.health}${deal.goLiveDate ? `, ${deal.goLiveDate}` : ""})`)
    .join(", ");
}

export function answerCustomerQuestion({
  question,
  data,
  brief,
  slackInsight,
  overallSentiment,
}: {
  question: string;
  data: CustomerData;
  brief: AccountBriefPayload;
  slackInsight: SlackInsightPayload | null;
  overallSentiment: OverallSentimentPayload | null;
}): AssistantAnswer {
  const q = question.trim().toLowerCase();

  if (/who.*(dri|owner)|dri|owner/.test(q)) {
    return {
      answer: data.driName
        ? `${data.driName} is the current DRI for ${data.config.name}.`
        : `No DRI is captured yet for ${data.config.name}.`,
      citations: brief.citations.slice(0, 1),
    };
  }

  if (/arr|revenue|mrr/.test(q)) {
    return {
      answer: `${data.config.name} is currently at ${formatCurrencyCompact(currentArr(data))} ARR across ${data.deals.length} tracked deal${data.deals.length === 1 ? "" : "s"}.`,
      citations: brief.citations.slice(0, 2),
    };
  }

  if (/activation|line/.test(q)) {
    return {
      answer: `${data.config.name} is tracking ${formatNumberCompact(currentLines(data))} current activations / lines in the latest available data.`,
      citations: brief.citations.slice(0, 2),
    };
  }

  if (/risk|blocker|issue|problem/.test(q)) {
    const risks = brief.top_risks.slice(0, 3).map((risk) => risk.summary);
    return {
      answer: risks.length > 0
        ? `Top risks right now: ${risks.join(" ")}`
        : `No explicit risks are captured in the current brief, but ${data.linearIssues.length} flagged issue${data.linearIssues.length === 1 ? "" : "s"} are tracked in Linear.`,
      citations: brief.top_risks.slice(0, 3).map((risk) => ({ label: risk.summary, url: risk.url })),
    };
  }

  if (/stakeholder|champion|contact|who cares/.test(q)) {
    const stakeholder = slackInsight?.stakeholders?.[0];
    if (stakeholder) {
      return {
        answer: `${stakeholder.name}${stakeholder.title ? ` (${stakeholder.title})` : ""} is the clearest current stakeholder signal: ${stakeholder.signal}`,
        citations: [{ label: stakeholder.signal, url: stakeholder.url }],
      };
    }
  }

  if (/deal|market|pipeline/.test(q)) {
    return {
      answer: `Tracked markets: ${listDeals(data)}.`,
      citations: brief.citations.slice(0, 2),
    };
  }

  if (/status|summary|what.*happening|overview/.test(q)) {
    return {
      answer: brief.headline,
      citations: brief.citations.slice(0, 3),
    };
  }

  return {
    answer:
      brief.headline +
      (overallSentiment?.summary && overallSentiment.summary !== brief.headline
        ? ` ${overallSentiment.summary}`
        : "") +
      ` Ask about status, blockers, ARR, activations, stakeholders, or specific markets for a tighter answer.`,
    citations: brief.citations.slice(0, 3),
  };
}
