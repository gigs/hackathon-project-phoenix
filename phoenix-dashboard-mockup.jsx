import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

// --- Mock Data ---
const arrData = [
  { month: "Jul", actual: 42000, forecast: 40000 },
  { month: "Aug", actual: 48000, forecast: 45000 },
  { month: "Sep", actual: 51000, forecast: 50000 },
  { month: "Oct", actual: 55000, forecast: 56000 },
  { month: "Nov", actual: 61000, forecast: 60000 },
  { month: "Dec", actual: 68000, forecast: 65000 },
  { month: "Jan", actual: 72000, forecast: 72000 },
  { month: "Feb", actual: 78000, forecast: 76000 },
  { month: "Mar", actual: 84000, forecast: 82000 },
  { month: "Apr", actual: null, forecast: 88000 },
  { month: "May", actual: null, forecast: 95000 },
  { month: "Jun", actual: null, forecast: 102000 },
];

const deals = [
  {
    id: 1,
    market: "US",
    flag: "🇺🇸",
    product: "eSIM",
    stage: "S3 Negotiation",
    stageIndex: 5,
    health: "green",
    dri: "David F.",
    driRole: "HubSpot Owner",
    arr: "$124K",
    activations: "2,340",
    goLive: "High — Jun 2026",
    miniData: [
      { m: "J", a: 8, f: 8 }, { m: "A", a: 10, f: 9 }, { m: "S", a: 12, f: 11 },
      { m: "O", a: 14, f: 13 }, { m: "N", a: 16, f: 15 }, { m: "D", a: 18, f: 18 },
    ],
    linearIssues: 2,
  },
  {
    id: 2,
    market: "UK",
    flag: "🇬🇧",
    product: "eSIM",
    stage: "S2 Proposal",
    stageIndex: 4,
    health: "yellow",
    dri: "Max B.",
    driRole: "Linear Owner",
    arr: "$86K",
    activations: "1,120",
    goLive: "Med — Q3 2026",
    miniData: [
      { m: "J", a: 4, f: 5 }, { m: "A", a: 5, f: 6 }, { m: "S", a: 6, f: 7 },
      { m: "O", a: 7, f: 9 }, { m: "N", a: 8, f: 10 }, { m: "D", a: 9, f: 12 },
    ],
    linearIssues: 4,
  },
  {
    id: 3,
    market: "France",
    flag: "🇫🇷",
    product: "Physical SIM",
    stage: "S1 Discovery",
    stageIndex: 3,
    health: "red",
    dri: "Tilly M.",
    driRole: "HubSpot Owner",
    arr: "~$2M (est.)",
    activations: "—",
    goLive: "Low — TBD",
    miniData: [
      { m: "J", a: 0, f: 2 }, { m: "A", a: 0, f: 4 }, { m: "S", a: 1, f: 6 },
      { m: "O", a: 1, f: 8 }, { m: "N", a: 2, f: 12 }, { m: "D", a: 2, f: 16 },
    ],
    linearIssues: 1,
  },
  {
    id: 4,
    market: "SE",
    flag: "🇸🇪",
    product: "eSIM",
    stage: "Pursuing",
    stageIndex: 1,
    health: "gray",
    dri: "Louisa K.",
    driRole: "HubSpot Owner",
    arr: "—",
    activations: "—",
    goLive: "No — Exploratory",
    miniData: [
      { m: "J", a: 0, f: 0 }, { m: "A", a: 0, f: 1 }, { m: "S", a: 0, f: 2 },
      { m: "O", a: 0, f: 3 }, { m: "N", a: 0, f: 4 }, { m: "D", a: 0, f: 5 },
    ],
    linearIssues: 0,
  },
];

const stages = ["Open Leads", "Pursuing", "Prospects", "S1 Discovery", "S2 Proposal", "S3 Negotiation", "S4 Closed Won"];

const notesAndIssues = [
  { id: 1, type: "linear", label: "API clone delay — blocked on connectivity partner", severity: "blocker", market: "France", link: "#", flagged: true },
  { id: 2, type: "linear", label: "Doc/presentation assets need review before S2 handoff", severity: "task", market: "UK", link: "#", flagged: true },
  { id: 3, type: "linear", label: "Pricing model v3 approved by Klarna procurement", severity: "done", market: "US", link: "#", flagged: false },
  { id: 4, type: "note", label: "Klarna wants link to developer assets portal before next sync. David to share API sandbox credentials.", market: "US", flagged: false },
  { id: 5, type: "note", label: "France LOI expected by end of April — contingent on connectivity confirmation from Orange.", market: "France", flagged: true },
  { id: 6, type: "linear", label: "Max embedding Lightdash charts into Linear project view", severity: "in-progress", market: "All", link: "#", flagged: false },
];

// --- Helpers ---
const healthColor = { green: "#22c55e", yellow: "#eab308", red: "#ef4444", gray: "#9ca3af" };
const severityColors = { blocker: "#ef4444", task: "#3b82f6", done: "#22c55e", "in-progress": "#a855f7" };

const formatCurrency = (v) => `€${(v / 1000).toFixed(0)}K`;

// --- Components ---
const HealthDot = ({ status }) => (
  <span style={{
    display: "inline-block", width: 10, height: 10, borderRadius: "50%",
    backgroundColor: healthColor[status], boxShadow: `0 0 6px ${healthColor[status]}44`,
  }} />
);

const MiniChart = ({ data }) => (
  <div style={{ width: 120, height: 40 }}>
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Area type="monotone" dataKey="f" stroke="#94a3b8" strokeWidth={1} fill="#f1f5f9" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="a" stroke="#6366f1" strokeWidth={1.5} fill="#eef2ff" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const StagePipeline = ({ currentIndex }) => (
  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
    {stages.map((s, i) => (
      <div key={s} title={s} style={{
        width: i <= currentIndex ? 18 : 14,
        height: 8,
        borderRadius: 4,
        backgroundColor: i < currentIndex ? "#6366f1" : i === currentIndex ? "#818cf8" : "#e2e8f0",
        transition: "all 0.2s",
      }} />
    ))}
  </div>
);

const LinearBadge = ({ count }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
    backgroundColor: count > 0 ? "#eef2ff" : "#f8fafc",
    color: count > 0 ? "#4f46e5" : "#94a3b8",
    border: `1px solid ${count > 0 ? "#c7d2fe" : "#e2e8f0"}`,
  }}>
    <svg width="12" height="12" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="45" stroke={count > 0 ? "#4f46e5" : "#94a3b8"} strokeWidth="10" />
      <circle cx="50" cy="50" r="20" fill={count > 0 ? "#4f46e5" : "#94a3b8"} />
    </svg>
    {count} {count === 1 ? "issue" : "issues"}
  </span>
);

export default function PhoenixDashboard() {
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const filteredNotes = activeTab === "all"
    ? notesAndIssues
    : notesAndIssues.filter(n => n.market === activeTab);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      backgroundColor: "#f8fafc", minHeight: "100vh", color: "#1e293b",
    }}>
      {/* Top nav bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, backgroundColor: "#4f46e5",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 14,
          }}>P</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Phoenix</span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>/ Accounts / Klarna</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0",
            backgroundColor: "#fff", fontSize: 13, color: "#64748b", cursor: "pointer",
          }}>Portfolio View</button>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", backgroundColor: "#e0e7ff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 600, color: "#4f46e5",
          }}>CB</div>
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
        {/* === HEADER ZONE === */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 12, padding: "24px",
          border: "1px solid #e2e8f0", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Left: Customer info */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, backgroundColor: "#FFB3C7",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "#fff",
                }}>K</div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Klarna</h1>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Fintech · Key Account · Stockholm, SE</span>
                </div>
                <HealthDot status="green" />
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "#22c55e", backgroundColor: "#f0fdf4",
                  padding: "2px 10px", borderRadius: 12,
                }}>Healthy</span>
              </div>

              {/* Quick links row */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                {[
                  { icon: "💬", label: "Slack", sub: "#klarna-external" },
                  { icon: "📞", label: "Last Contact", sub: "2 days ago" },
                  { icon: "🏢", label: "HubSpot", sub: "Key Account" },
                  { icon: "📋", label: "Linear", sub: "4 projects" },
                ].map((item) => (
                  <div key={item.label} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    borderRadius: 8, backgroundColor: "#f8fafc", border: "1px solid #f1f5f9",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#eef2ff"; e.currentTarget.style.borderColor = "#c7d2fe"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#f1f5f9"; }}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: ARR Chart */}
            <div style={{ width: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Customer ARR — Actuals vs Forecast</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#1e293b" }}>€84K <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 500 }}>↑ 12%</span></span>
              </div>
              <div style={{ height: 120 }}>
                <ResponsiveContainer>
                  <AreaChart data={arrData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={formatCurrency} width={45} />
                    <Tooltip formatter={(v) => [`€${(v/1000).toFixed(0)}K`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="forecast" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="6 3" fill="none" />
                    <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} fill="url(#actualGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#6366f1", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 16, height: 2, backgroundColor: "#6366f1", display: "inline-block" }} /> Actual
                </span>
                <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 16, height: 2, backgroundColor: "#cbd5e1", display: "inline-block", borderTop: "1px dashed #94a3b8" }} /> Forecast
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* === MAIN CONTENT: Deals + Notes === */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
          {/* Deals Table */}
          <div style={{
            backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Deals by Market</h2>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{deals.length} deals · HubSpot pipeline</span>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "140px 60px 150px 120px 80px 90px 90px 80px",
              padding: "10px 20px",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #f1f5f9",
              fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              <span>Market</span>
              <span>Health</span>
              <span>Pipeline Stage</span>
              <span>ARR Trend</span>
              <span>ARR</span>
              <span>Go-Live</span>
              <span>DRI</span>
              <span>Linear</span>
            </div>

            {/* Deal rows */}
            {deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedDeal(selectedDeal === deal.id ? null : deal.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 60px 150px 120px 80px 90px 90px 80px",
                  padding: "14px 20px",
                  alignItems: "center",
                  borderBottom: "1px solid #f8fafc",
                  cursor: "pointer",
                  backgroundColor: selectedDeal === deal.id ? "#fafafe" : "#fff",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (selectedDeal !== deal.id) e.currentTarget.style.backgroundColor = "#fafafe"; }}
                onMouseLeave={e => { if (selectedDeal !== deal.id) e.currentTarget.style.backgroundColor = "#fff"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{deal.flag}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Klarna {deal.market}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{deal.product}</div>
                  </div>
                </div>
                <HealthDot status={deal.health} />
                <div>
                  <StagePipeline currentIndex={deal.stageIndex} />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{deal.stage}</div>
                </div>
                <MiniChart data={deal.miniData} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{deal.arr}</span>
                <span style={{
                  fontSize: 11, color:
                    deal.goLive.startsWith("High") ? "#22c55e" :
                    deal.goLive.startsWith("Med") ? "#eab308" :
                    deal.goLive.startsWith("Low") ? "#ef4444" : "#94a3b8",
                  fontWeight: 500,
                }}>{deal.goLive}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{deal.dri}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{deal.driRole}</div>
                </div>
                <LinearBadge count={deal.linearIssues} />
              </div>
            ))}
          </div>

          {/* === NOTES & ISSUES PANEL === */}
          <div style={{
            backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Notes & Issues</h2>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "US", "UK", "France", "SE"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "none",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      backgroundColor: activeTab === tab ? "#eef2ff" : "transparent",
                      color: activeTab === tab ? "#4f46e5" : "#94a3b8",
                    }}
                  >{tab === "all" ? "All" : tab}</button>
                ))}
              </div>
            </div>

            <div style={{ padding: "8px 12px", flex: 1, overflowY: "auto" }}>
              {filteredNotes.map(item => (
                <div key={item.id} style={{
                  padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                  backgroundColor: item.flagged ? "#fffbeb" : "#f8fafc",
                  border: `1px solid ${item.flagged ? "#fde68a" : "#f1f5f9"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    {item.flagged && <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>ℹ️</span>}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {item.type === "linear" ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                            backgroundColor: severityColors[item.severity] + "18",
                            color: severityColors[item.severity],
                            textTransform: "uppercase",
                          }}>{item.severity}</span>
                        ) : (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                            backgroundColor: "#f0fdf4", color: "#16a34a", textTransform: "uppercase",
                          }}>Note</span>
                        )}
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{item.market}</span>
                      </div>
                      <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5, color: "#374151" }}>{item.label}</p>
                      {item.type === "linear" && (
                        <a href={item.link} style={{
                          fontSize: 11, color: "#6366f1", textDecoration: "none", marginTop: 4,
                          display: "inline-block",
                        }}>Open in Linear →</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add note button */}
              <button style={{
                width: "100%", padding: "10px", borderRadius: 8,
                border: "1px dashed #d1d5db", backgroundColor: "transparent",
                fontSize: 12, color: "#94a3b8", cursor: "pointer",
                marginTop: 4,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#94a3b8"; }}
              >+ Add note</button>
            </div>

            {/* Data sources footer */}
            <div style={{
              padding: "10px 16px", borderTop: "1px solid #f1f5f9",
              fontSize: 10, color: "#94a3b8", display: "flex", gap: 12,
            }}>
              <span>Sources:</span>
              <span style={{ color: "#6366f1" }}>HubSpot</span>
              <span style={{ color: "#6366f1" }}>Linear</span>
              <span style={{ color: "#6366f1" }}>Lightdash</span>
              <span style={{ color: "#6366f1" }}>Slack</span>
            </div>
          </div>
        </div>

        {/* === SCORECARD FOOTER === */}
        <div style={{
          marginTop: 20, backgroundColor: "#fff", borderRadius: 12,
          border: "1px solid #e2e8f0", padding: "16px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Quality Gates — Early Lifecycle (Presales → S2)</h2>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Scorecard inputs per deal</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Test Project Created", status: "done", detail: "Product interaction confirmed" },
              { label: "SOW Status", status: "progress", detail: "Drafted — awaiting legal" },
              { label: "Figma Received", status: "done", detail: "Handed off 9 Apr" },
              { label: "Contract Signed", status: "pending", detail: "Pending SOW finalisation" },
              { label: "Slack Channel Active", status: "done", detail: "#klarna-external — 12 msgs/wk" },
              { label: "Pricing Approved", status: "done", detail: "v3 approved by procurement" },
              { label: "Connectivity Deps", status: "risk", detail: "Orange partnership TBC (France)" },
              { label: "Deal Review Complete", status: "pending", detail: "Scheduled for 21 Apr" },
            ].map((gate) => (
              <div key={gate.label} style={{
                padding: "10px 14px", borderRadius: 8,
                backgroundColor:
                  gate.status === "done" ? "#f0fdf4" :
                  gate.status === "progress" ? "#eff6ff" :
                  gate.status === "risk" ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${
                  gate.status === "done" ? "#bbf7d0" :
                  gate.status === "progress" ? "#bfdbfe" :
                  gate.status === "risk" ? "#fecaca" : "#e2e8f0"
                }`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor:
                      gate.status === "done" ? "#22c55e" :
                      gate.status === "progress" ? "#3b82f6" :
                      gate.status === "risk" ? "#ef4444" : "#94a3b8",
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{gate.label}</span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>{gate.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Page footer */}
        <div style={{
          marginTop: 20, padding: "12px 0", textAlign: "center",
          fontSize: 11, color: "#cbd5e1",
        }}>
          Project Phoenix · Gigs · Centralised Customer View · v0.1 Mockup
        </div>
      </div>
    </div>
  );
}
