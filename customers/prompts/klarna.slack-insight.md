# Klarna — Relationship Context

Scope: Klarna Mobile only. Live in the US, expanding to UK → Sweden → France → Germany. Disregard Klarna HR / employee mobile lines.

## Task

Read the Slack channels listed below. Analyze activity from the last 30 days. Return a single JSON object matching the schema at the end of this prompt. No prose outside the JSON.

## Sources

- Slack channels:
  C06TU74L51T
  

## Context

Klarna Mobile is Klarna's consumer mobile product — Klarna-branded postpaid plans sold to Klarna app users, shipped via direct integration with the Gigs API. Live in the US, with UK, Sweden, France, and Germany launches planned across late 2026 into early 2027. All four international launches are Gigs-dependent on market availability, eSIM provisioning, and regulatory posture, so launch risk and commercial terms for those markets are the most active commercial surface in the relationship.

Klarna is not positioning Mobile to compete on price against low-cost US carriers. The strategic bet is ecosystem integration: Mobile makes the existing Klarna app user base more engaged and monetizable, with cross-sell from device financing, bundling into premium tiers, and travel benefits layered on top. The plan explicitly acknowledges that Mobile's role inside the Klarna brand is still being defined, and that value communication — not pricing — is the primary conversion challenge. This matters for reading Slack: discussions about funnel UX, bundling, and device cross-sell are all downstream of these unresolved strategic questions.

## Stakeholders

The Klarna Mobile team is a cross-functional team, created for the purpose of launching the Klarna Mobile product. The key stakeholders are below. Weight them according to their individual importance.

- **Ludo Lombaard** — Innovation Director, primary decision-maker — the Klarna Mobile lead sits within his organisation. Owns terms, renewals, pricing negotiations. Direct style, likes to make quick decisions.
- **Thomas Elvestad** — Marketing Director, primary Klarna sponsor. Lead of the Klarna Mobile team. Tone is a reliable proxy for overall Klarna confidence in the relationship.
- **Mauro Marroncelli** — Product Delivery Lead. Owns project management, execution and shipping. Main collaborator for legal and operational matters.
- **Olivier Guzzi** — Engineering Lead. Owns the technical integration surface; counterpart for anything API, provisioning, eSIM, porting, or incident-related.
- **Jamie Russell** — UX Lead. High signal on funnel/UX work.
- **Erik Gollne** — Marketing Lead. Under internal budget pressure for Mobile; frustration or disengagement here is an early indicator of deprioritization.

## Stakeholder sentiment instructions

For each stakeholder, assess their sentiment based on Slack messages from the last 30 days.

**Signals to look for:**

- **Engagement level** — are they posting, responding, reacting? Silence from a previously active stakeholder is a signal.
- **Tone** — are their messages collaborative, frustrated, transactional, enthusiastic? Note shifts relative to prior period.
- **Responsiveness** — are they responding to Gigs messages quickly or leaving threads unanswered?
- **Escalation language** — phrases like "still waiting", "this is urgent", "I've asked before" indicate friction even if no formal issue exists.

**Sentiment:** `positive` / `neutral` / `negative` / `no_signal` (insufficient data in the window)
**Signal:** one short sentence describing what drove the assessment — or "No recent Slack activity" if absent.

## Updates and signals

**Updates** — most significant Slack messages and from the window. Qualifying items: project status changes, blockers flagged, milestones or actuals reported, material scope shifts. **Return 1-3 updates. Maximum 3. Rank by significance, not recency.**

**Signals** — interpreted observations, categorized as:

- `warning` — friction, disengagement, unresolved blockers, silence on open items
- `momentum` — shipped work, positive engagement, proactive Klarna behavior
- `opportunity` — expansion language, new scope signals, stakeholder pull
- `change` — new or departed people, context shifts requiring prompt updates

Signals must cite Slack as evidence. URLs may be null only for silence-based observations. **Return 3 signals. Maximum 5. Rank by importance.**

## Output

```json
{
  "health": {
    "status": "green | yellow | red",
    "summary": "One sentence on the current state of the relationship."
  },
  "stakeholders": [
    {
      "name": "string",
      "sentiment": "positive | neutral | negative | no_signal",
      "signal": "One sentence describing what drove the assessment.",
      "url": "string | null"
    }
  ],
  "updates": [
    {
      "summary": "What happened.",
      "url": "string",
      "timestamp": "YYYY-MM-DD"
    }
  ],
  "signals": [
    {
      "type": "warning | momentum | opportunity | change",
      "summary": "One sentence.",
      "url": "string | null"
    }
  ]
}
```
