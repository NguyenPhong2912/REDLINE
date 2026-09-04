import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard, Bot, BarChart3, Globe, Wallet, ScrollText,
  Layers, Settings, ChevronRight, Search, ShieldCheck,
  Activity, Sparkles,
  Key, Timer, Lock,
  TrendingUp, Cpu, DollarSign, CheckCircle2, AlertTriangle,
  Clock, Network, ExternalLink,
  Plus, PieChart, Shield, ArrowLeft, ArrowRight, Rows3, Menu, X, BookOpen,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GrantSignButton } from "./components/GrantSignButton";
import { GrantsPanel } from "./components/GrantsPanel";
import { LiveFeed } from "./components/LiveFeed";
import { VaultPanel } from "./components/VaultPanel";
import { SolanaWalletControl } from "./components/SolanaWalletControl";
import { AuditPage } from "./components/AuditPage";
import { DashboardLiveGrants } from "./components/DashboardLiveGrants";
import { PageTransition } from "./components/PageTransition";
import { ProtocolSpine } from "./components/ProtocolSpine";
import { SpatialBackdrop } from "./components/SpatialBackdrop";
import { ProtocolExperience } from "./components/ProtocolExperience";
import { CommandPalette, type CommandItem } from "./components/CommandPalette";
import { RouteScene } from "./components/RouteScene";
import { SoundControl } from "./components/SoundControl";
import { GuidePage } from "./components/GuidePage";
import { CopilotPage, ModelsPage, ProfilePage } from "./components/ArtifactPages";
import { FlipCard, TransferLane } from "./components/depth";
import { playSound } from "./lib/soundscape";
import {
  requestRiskAssessment,
  type AgentPolicyInput,
  type RiskAssessment,
} from "./lib/risk-engine";
import { address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { api, API_URL, checkHealth, fmtUsdc, short, type AgentVersion, type Analytics, type AuditRow, type Health, type Hire, type Listing } from "./lib/api";
import { PROGRAM_ID } from "./solana/redline";
import { useRealAgents } from "./lib/agents";
import type { AppClient } from "./solana/client";
import { explorerAddressUrl, explorerTransactionUrl, isAddressLike } from "./solana/client";

// The program's Grant account stores at most four of each.
const MAX_DESTS = 4;
// Used only when nothing has been published yet — the first grant publishes an
// agent version from this, and every later grant names one that already exists.
const FALLBACK_AGENT = {
  name: "YieldGuard Alpha",
  strategy: "Risk-bounded DeFi yield optimization with human review for high-impact actions",
};
const DEMO_OPS_DESTINATION = String(import.meta.env.VITE_DEMO_OPS_DESTINATION ?? "");
import { transferSolInstruction } from "./solana/payments";
import { color, mono, sans } from "./theme";

/* ── palette ── */
const M = color.primary;
const C = color.info;
const A = color.warn;
const BG = color.bg;

/* ── glass helper ── */
const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: color.surface,
  border: `1px solid ${color.border}`,
  ...extra,
});

/* ── chart tooltip ── */
function ChartTip({ active, payload, accent = M, prefix = "", suffix = "" }: { active?: boolean; payload?: { value: number }[]; accent?: string; prefix?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-2.5 py-1.5 rounded-lg text-[13px]" style={{ ...mono, background: color.surface, border: `1px solid ${accent}28`, color: accent }}>
      {prefix}{Number(payload[0].value).toLocaleString()}{suffix}
    </div>
  );
}


const NAV = [
  { icon: LayoutDashboard, label: "Protocol", slug: "protocol" },
  { icon: Bot, label: "Agents", slug: "agents" },
  { icon: BarChart3, label: "Analytics", slug: "analytics" },
  { icon: Globe, label: "Marketplace", slug: "marketplace" },
  { icon: Wallet, label: "Treasury", slug: "treasury" },
  { icon: ScrollText, label: "Audit", slug: "audit" },
  { icon: Layers, label: "Guardrails", slug: "guardrails" },
  { icon: Settings, label: "Settings", slug: "settings" },
  { icon: BookOpen, label: "Guide", slug: "guide" },
  { icon: Sparkles, label: "Copilot", slug: "copilot" },
  { icon: Cpu, label: "Models", slug: "models" },
  { icon: Wallet, label: "Profile", slug: "profile" },
];

// Keep the long-lived page indexes stable because protocol actions navigate by
// index. The artifact defines a separate reading order and top-navigation order.
const FLOW_ORDER = [0, 3, 1, 6, 4, 5, 2, 7, 9, 10, 11] as const;
const HEADER_ORDER = [0, 3, 1, 6, 4, 5, 2, 9, 10, 7] as const;

/* ── reusable components ── */
function Badge({ status }: { status: string }) {
  const col = status === "ACTIVE" ? M : status === "PAUSED" ? A : color.textMuted;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
      style={{ ...mono, background: `${col}12`, color: col, border: `1px solid ${col}25` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col, animation: status === "ACTIVE" ? "redline-pulse 2s infinite" : "none" }} />
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, accent, icon: Icon, data, gradId }: { label: string; value: string; sub: string; accent: string; icon: React.ElementType; data: { t: string; v: number }[]; gradId: string }) {
  return (
    <div className="relative rounded-2xl p-5 flex flex-col gap-3 overflow-hidden group transition-transform duration-300 hover:-translate-y-0.5"
      style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at 20% 0%, ${accent}10 0%, transparent 60%)` }} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${accent}14`, border: `1px solid ${accent}20` }}>
            <Icon size={13} style={{ color: accent }} />
          </div>
          <span className="text-xs font-medium" style={{ ...sans, color: color.textSecondary }}>{label}</span>
        </div>
        <span className="text-[13px] text-right" style={{ ...mono, color: color.textDim }}>{sub}</span>
      </div>
      <div className="text-3xl font-bold tracking-tighter" style={{ ...mono, color: color.text }}>{value}</div>
      <div className="h-14 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} />
            <Tooltip content={<ChartTip accent={accent} />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, text, accent = M }: { icon: React.ElementType; text: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-1.5 rounded-lg" style={{ background: `${accent}14`, border: `1px solid ${accent}20` }}>
        <Icon size={13} style={{ color: accent }} />
      </div>
      <span className="text-[13px] font-bold tracking-[0.18em] uppercase" style={{ ...sans, color: color.textSecondary }}>{text}</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color.border}, transparent)` }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── 1. DASHBOARD ── */
function DashboardPage({ setNav }: { setNav?: (n: number) => void }) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const { agents } = useRealAgents();
  const [stats, setStats] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!owner) { setStats(null); return; }
    let live = true;
    const load = () => api.analytics(owner).then(d => { if (live) setStats(d); }).catch(() => { /* dashboard degrades to em-dashes */ });
    load();
    const t = setInterval(load, 15_000);
    return () => { live = false; clearInterval(t); };
  }, [owner]);

  const flat = (v: number) => Array.from({ length: 7 }, (_, i) => ({ t: String(i), v }));
  const volumeSeries = stats?.weeklyVolume.map(d => ({ t: d.t, v: d.volumeUsdc })) ?? flat(0);
  const expiringSoon = agents
    .filter(a => a.latestExpiresAt && a.activeGrants > 0)
    .filter(a => new Date(a.latestExpiresAt!).getTime() - Date.now() < 3600_000)
    .sort((x, y) => (x.latestExpiresAt! < y.latestExpiresAt! ? -1 : 1))[0];

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}20` }}><Sparkles size={12} style={{ color: M }} /></div>
          <span className="text-[12px] font-bold tracking-[0.2em] uppercase" style={{ ...mono, color: M }}>REDLINE Overview</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>Autonomous finance. <span style={{ color: M }}>Hard limits.</span></h1>
        <p className="text-sm mt-1" style={{ ...sans, color: color.textDim }}>Design agent permissions, assess operational risk, and anchor policy proofs on Solana.</p>
        {!owner && <span className="inline-flex mt-3 text-[11px] px-2 py-1 rounded-full tracking-widest" style={{ ...mono, color: A, background: `${A}10`, border: `1px solid ${A}25` }}>CONNECT A WALLET TO SEE YOUR NUMBERS</span>}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Active Grants" value={stats ? String(stats.activeGrants) : "—"} sub={stats ? `${stats.totalGrants} total` : "connect wallet"} icon={Bot} accent={M} data={flat(stats?.activeGrants ?? 0)} gradId="kpi-agents" />
        <KpiCard label="Volume Moved" value={stats ? `${stats.totalVolumeUsdc.toLocaleString()}` : "—"} sub="USDC settled on-chain" icon={DollarSign} accent={A} data={volumeSeries} gradId="kpi-vol" />
        <KpiCard label="Avg. Decision" value={stats?.avgDecisionLatencyMs != null ? `${stats.avgDecisionLatencyMs}ms` : "—"} sub="precheck → decision" icon={Cpu} accent={C} data={flat(stats?.avgDecisionLatencyMs ?? 0)} gradId="kpi-lat" />
        <KpiCard label="Allowed by Policy" value={stats?.successRatePct != null ? `${stats.successRatePct}%` : "—"} sub={stats ? `${stats.totalRejections} blocked` : "no decisions yet"} icon={CheckCircle2} accent={M} data={flat(stats?.successRatePct ?? 0)} gradId="kpi-success" />
      </div>

      <ProtocolSpine owner={owner || undefined} />

      {/* Volume chart */}
      <div className="rounded-2xl p-5" style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Weekly Execution Volume</div>
            <div className="text-[13px] mt-0.5" style={{ ...sans, color: color.textDim }}>USDC confirmed on-chain · your grants</div>
          </div>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.weeklyVolume ?? []} barSize={24}>
              <defs>
                <linearGradient id="bar-vol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={M} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={M} stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: color.textDim, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: color.textDim, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip accent={M} suffix=" USDC" />} />
              <Bar dataKey="volumeUsdc" fill="url(#bar-vol)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live grants from on-chain */}
      <DashboardLiveGrants onNavigate={setNav ? () => setNav(6) : undefined} />

      {/* Activity log + quick agent list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live runtime feed from the API (SSE) */}
        <LiveFeed />

        {/* Quick agents */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: color.border }}>
            <span className="text-sm font-semibold" style={{ ...sans, color: color.text }}>My Agents</span>
            <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ ...mono, background: `${M}14`, color: M, border: `1px solid ${M}25` }}>{agents.filter(a => a.status === "ACTIVE").length} active</span>
          </div>
          {agents.length === 0 && <div className="px-5 py-4 text-xs" style={{ ...sans, color: color.textDim }}>No agents published yet.</div>}
          {agents.slice(0, 6).map((a, i) => (
            <div key={`dash-agent-${a.id}`} className="flex items-center gap-3 px-5 py-3 border-b hover:bg-white/[0.018] transition-colors"
              style={{ borderColor: i < Math.min(agents.length, 6) - 1 ? color.border : "transparent" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${AGENT_ACCENTS[i % AGENT_ACCENTS.length]}12`, border: `1px solid ${AGENT_ACCENTS[i % AGENT_ACCENTS.length]}22` }}>
                <Bot size={14} style={{ color: AGENT_ACCENTS[i % AGENT_ACCENTS.length] }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ ...sans, color: color.text }}>{a.name}</div>
                <div className="text-[12px]" style={{ ...sans, color: color.textDim }}>{a.version}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold" style={{ ...mono, color: M }}>{a.totalSpentUsdc.toLocaleString()} USDC</div>
                <Badge status={a.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real expiry warning, only when a grant genuinely expires within the hour */}
      {expiringSoon && (
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: `${A}09`, border: `1px solid ${A}20` }}>
          <div className="p-2 rounded-xl" style={{ background: `${A}14`, border: `1px solid ${A}25` }}><AlertTriangle size={14} style={{ color: A }} /></div>
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{ ...sans, color: color.text }}>Policy Review Recommended</div>
            <div className="text-[13px] mt-0.5" style={{ ...sans, color: color.textMuted }}>{expiringSoon.name} policy expires {new Date(expiringSoon.latestExpiresAt!).toLocaleTimeString()}. Review before extending agent permissions.</div>
          </div>
          {setNav && <button type="button" onClick={() => setNav(6)} className="px-4 py-2 rounded-xl text-[13px] font-semibold" style={{ ...sans, background: `${A}14`, border: `1px solid ${A}30`, color: A }}>Open Guardrails</button>}
        </div>
      )}
    </div>
  );
}

/* ── 2. AGENTS ── */
const AGENT_ACCENTS = [M, C, A, color.info];

function AgentsPage() {
  const { agents, loading, error, reload } = useRealAgents();
  const [sel, setSel] = useState(0);
  const [deploying, setDeploying] = useState(true);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const [deployError, setDeployError] = useState("");

  const a = agents[Math.min(sel, agents.length - 1)];
  const accent = (i: number) => AGENT_ACCENTS[i % AGENT_ACCENTS.length];

  async function deploy() {
    if (!name.trim() || !strategy.trim()) return;
    setBusy(true); setDeployError("");
    try {
      // agentHash is sha256(modelRef|codeRef|config) — name and version are not
      // part of it. A dashboard-declared agent has no build artifact to point
      // at, so its identity is what the operator typed; feeding that into the
      // refs keeps two differently-named agents from collapsing into one row.
      await api.publishAgent({
        name: name.trim(), version: "v1.0.0", strategy: strategy.trim(),
        modelRef: "manual:dashboard", codeRef: `manual:${name.trim()}`, config: { strategy: strategy.trim() },
      });
      setName(""); setStrategy(""); setDeploying(false);
      await reload();
    } catch (e) { setDeployError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="route-page page-agents space-y-8">
      <div className="route-local-heading flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>My Agents</h1>
          <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>Real agent versions and grants from the REDLINE API</p>
        </div>
        <button type="button" onClick={() => setDeploying(d => !d)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ ...sans, background: `${M}12`, border: `1px solid ${M}28`, color: M }}>
          <Plus size={13} />Publish Agent Version
        </button>
      </div>

      {deploying && (
        <div className="agent-publish-panel rounded-2xl p-5 flex flex-col gap-3" style={{ ...glass() }}>
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Publish a new version</div><div className="text-[11px] mt-1 tracking-widest" style={{ ...mono, color: color.textDim }}>DRAFT · IMMUTABLE HASH</div></div>
            <button type="button" onClick={() => setDeploying(false)} aria-label="Close publishing panel" className="p-1 rounded-md" style={{ color: color.textDim }}><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Agent name" className="px-3.5 py-2.5 rounded-xl text-xs outline-none" style={{ ...sans, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.text }} />
            <input value={strategy} onChange={e => setStrategy(e.target.value)} placeholder="Strategy description" className="px-3.5 py-2.5 rounded-xl text-xs outline-none" style={{ ...sans, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.text }} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy || !name.trim() || !strategy.trim()} onClick={deploy} className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40" style={{ ...sans, background: `${M}18`, border: `1px solid ${M}35`, color: M }}>
              {busy ? "Publishing…" : "Publish"}
            </button>
            {deployError && <span className="text-[13px]" style={{ ...mono, color: color.danger }}>{deployError}</span>}
          </div>
          <p className="text-[12px]" style={{ ...sans, color: color.textDim }}>Registers a real AgentVersion via POST /agents — the agentHash is a real sha256 of the model/code/config refs. Create a grant for it from Guardrails afterward.</p>
        </div>
      )}

      {loading && <div className="text-xs" style={{ ...sans, color: color.textDim }}>Loading agents…</div>}
      {error && <div className="text-xs" style={{ ...mono, color: color.danger }}>{error}</div>}
      {!loading && !error && agents.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ ...glass() }}>
          <p className="text-sm" style={{ ...sans, color: color.textMuted }}>No agents published yet — publish one above, or create a grant from Guardrails (which publishes one automatically).</p>
        </div>
      )}

      {!loading && agents.length > 0 && a && (
        <div className="agent-composition grid grid-cols-1 lg:grid-cols-[minmax(320px_.72fr)_minmax(0_1.45fr)] gap-7">
          {/* Agent list */}
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ ...glass() }}>
            {agents.map((ag, i) => (
              <button type="button" key={`ag-list-${ag.id}`} onClick={() => setSel(i)} aria-pressed={sel === i}
                className="flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b"
                style={{ borderColor: color.border, background: sel === i ? `${accent(i)}0c` : "transparent", borderLeft: sel === i ? `2px solid ${accent(i)}` : "2px solid transparent" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent(i)}14`, border: `1px solid ${accent(i)}22` }}>
                  <Bot size={16} style={{ color: accent(i) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ ...sans, color: color.text }}>{ag.name}</div>
                  <div className="text-[12px] mt-0.5" style={{ ...sans, color: color.textDim }}>{ag.version}</div>
                </div>
                <Badge status={ag.status} />
              </button>
            ))}
            {!deploying && (
              <button type="button" onClick={() => setDeploying(true)} className="agent-publish-open">
                <Plus size={13} />Publish agent version
              </button>
            )}
          </div>

          {/* Agent detail */}
          <div className="space-y-4">
            <FlipCard hint="CLICK THE CARD · SEE HOW THE HASH IS BUILT" back={(
              <>
                <small>AGENT HASH · SHA-256</small>
                <h3>{a.name} · {a.version}</h3>
                <code>{a.agentHash}</code>
                <div className="formula">
                  <span>sha256(</span>
                  <b>modelRef</b><i>|</i><b>codeRef</b><i>|</i><b>config</b>
                  <span>)</span>
                </div>
                <p>Name and version are labels; the hash is the identity. Every grant records it, so a policy binds to exactly this build — change one byte and it is a different agent.</p>
              </>
            )} front={(
            <div className="rounded-2xl p-6 relative overflow-hidden" style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
              <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent(sel)}60, transparent)` }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 0% 0%, ${accent(sel)}08, transparent 60%)` }} />
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${accent(sel)}14`, border: `1px solid ${accent(sel)}2a` }}>
                  <Bot size={22} style={{ color: accent(sel) }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-bold" style={{ ...sans, color: color.text }}>{a.name}</h2>
                    <Badge status={a.status} />
                  </div>
                  <div className="text-xs mt-1" style={{ ...mono, color: C }}>{short(a.agentHash, 8)}</div>
                  <p className="text-[13px] mt-1 max-w-md" style={{ ...sans, color: color.textMuted }}>{a.strategy}</p>
                </div>
              </div>
              <div className="agent-metrics grid grid-cols-2 sm:grid-cols-4 gap-0">
                {[
                  { label: "Active Grants", value: String(a.activeGrants), color: M },
                  { label: "Total Grants", value: String(a.totalGrants), color: C },
                  { label: "Total Spent", value: `${a.totalSpentUsdc.toLocaleString()} USDC`, color: A },
                  { label: "Total Transfers", value: String(a.totalTx), color: M },
                ].map((s, i) => (
                  <div key={`det-stat-${i}`} className="rounded-xl p-3" style={{ background: color.surfaceSubtle, border: `1px solid ${color.border}` }}>
                    <div className="text-[12px] mb-1" style={{ ...sans, color: color.textDim }}>{s.label}</div>
                    <div className="text-base font-bold" style={{ ...mono, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            )} />

            {/* Grants for this agent */}
            <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: color.border }}>
                <span className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Grants</span>
                <span className="text-[12px]" style={{ ...sans, color: color.textDim }}>{a.grants.length} total</span>
              </div>
              {a.grants.length === 0 && <div className="px-5 py-4 text-xs" style={{ ...sans, color: color.textDim }}>No grants yet for this agent.</div>}
              {a.grants.map(g => (
                <div key={g.id} className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: color.border }}>
                  <span className="text-[13px] flex-1" style={{ ...mono, color: C }}>{short(g.grantPda)}</span>
                  <span className="text-[13px]" style={{ ...mono, color: color.textSecondary }}>{fmtUsdc(g.spentUnits)}/{fmtUsdc(g.policyVersion.spendCapUnits)} USDC</span>
                  <span className="text-[13px]" style={{ ...mono, color: color.textDim }}>{g.transactionCount}/{g.policyVersion.maxTransactions} tx</span>
                  <Badge status={g.revoked ? "REVOKED" : "ACTIVE"} />
                </div>
              ))}
            </div>

            {/* Latest policy expiry */}
            {a.latestExpiresAt && (
              <div className="rounded-2xl p-5 flex items-center gap-4" style={{ ...glass() }}>
                <div className="p-2.5 rounded-xl" style={{ background: `${M}12`, border: `1px solid ${M}22` }}>
                  <Key size={16} style={{ color: M }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ ...sans, color: color.text }}>Latest grant policy</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[13px]" style={{ ...mono, color: color.textDim }}>Expires:</span>
                    <span className="text-[13px] font-bold" style={{ ...mono, color: M }}>{new Date(a.latestExpiresAt).toLocaleString()}</span>
                  </div>
                </div>
                {a.lastActiveAt && <span className="text-[12px]" style={{ ...mono, color: color.textDim }}>last active {new Date(a.lastActiveAt).toLocaleString()}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3. ANALYTICS ── */
function AnalyticsPage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!owner) { setData(null); return; }
    let live = true;
    const load = () => api.analytics(owner).then(d => { if (live) { setData(d); setError(""); } }).catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    load();
    const t = setInterval(load, 15_000);
    return () => { live = false; clearInterval(t); };
  }, [owner]);

  return (
    <div className="route-page page-analytics space-y-7">
      <div className="route-local-heading">
        <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>Analytics</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>Computed from your grants' real audit trail — no price feed, so no P&L or APY</p>
      </div>

      {!owner && <div className="rounded-2xl p-8 text-center" style={{ ...glass() }}><p className="text-sm" style={{ ...sans, color: color.textMuted }}>Connect a wallet to see analytics for your grants.</p></div>}
      {owner && error && <div className="text-xs" style={{ ...mono, color: color.danger }}>{error}</div>}

      {owner && data && (
        <>
          <div className="analytics-ledger grid grid-cols-2 sm:grid-cols-4 gap-0">
            {[
              { label: "Active Grants", value: String(data.activeGrants) },
              { label: "Total Volume", value: `${data.totalVolumeUsdc.toLocaleString()} USDC` },
              { label: "Success Rate", value: data.successRatePct === null ? "—" : `${data.successRatePct}%` },
              { label: "Avg Decision Latency", value: data.avgDecisionLatencyMs === null ? "—" : `${data.avgDecisionLatencyMs}ms` },
            ].map((s, i) => (
              <div key={`an-kpi-${i}`} className="analytics-stat p-5" style={{ borderRight: `1px solid ${color.border}` }}>
                <div className="text-[13px] mb-2" style={{ ...sans, color: color.textDim }}>{s.label}</div>
                <div className="text-xl font-bold" style={{ ...mono, color: color.text }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Weekly volume */}
          <div className="analytics-volume rounded-[28px] p-6" style={{ ...glass() }}>
            <SectionTitle icon={TrendingUp} text="Confirmed Volume — Last 7 Days" />
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyVolume} barSize={28}>
                  <defs>
                    <linearGradient id="vol-bar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={M} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={M} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: color.textDim, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: color.textDim, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip accent={M} suffix=" USDC" />} />
                  <Bar dataKey="volumeUsdc" fill="url(#vol-bar)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top agents by volume */}
          <div className="analytics-ranking rounded-[28px] overflow-hidden" style={{ ...glass() }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: color.border }}>
              <span className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Top Agents by Volume</span>
            </div>
            {data.topAgentsByVolume.length === 0 && <div className="px-5 py-4 text-xs" style={{ ...sans, color: color.textDim }}>No confirmed transfers yet.</div>}
            {data.topAgentsByVolume.map((a, i) => (
              <div key={`an-ag-${i}`} className="grid items-center px-5 py-3 border-b hover:bg-white/[0.018] transition-colors"
                style={{ gridTemplateColumns: "1fr 120px 80px", borderColor: color.border }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${M}12`, border: `1px solid ${M}20` }}><Bot size={11} style={{ color: M }} /></div>
                  <span className="text-xs font-medium" style={{ ...sans, color: color.text }}>{a.name}</span>
                </div>
                <span className="text-[13px] font-bold" style={{ ...mono, color: M }}>{a.volumeUsdc.toLocaleString()} USDC</span>
                <span className="text-[13px]" style={{ ...mono, color: color.textDim }}>{a.grants} grant{a.grants === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>

          <div className="text-[13px]" style={{ ...sans, color: color.textDim }}>
            {data.totalTransactions} confirmed · {data.totalRejections} rejected by the on-chain gates across {data.totalGrants} grant{data.totalGrants === 1 ? "" : "s"}.
          </div>
        </>
      )}
    </div>
  );
}

/* ── 4. MARKETPLACE ── */
const LAMPORTS_PER_SOL = 1_000_000_000;
const fmtSol = (lamports: string) => (Number(lamports) / LAMPORTS_PER_SOL).toLocaleString("en-US", { maximumFractionDigits: 4 });

function MarketplacePage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const wallet = connected ? String(connected.account.address) : "";
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [pricedOnly, setPricedOnly] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [priceSol, setPriceSol] = useState("0.05");
  // Per-listing rental length. The price is a 24h rate, so the total scales
  // with the periods covered — the backend charges the same way.
  const [hours, setHours] = useState<Record<string, number>>({});
  const hoursFor = (id: string) => hours[id] ?? 24;
  const periodsFor = (id: string) => Math.ceil(hoursFor(id) / 24);

  // `error` also carries claim/rent failures, so the empty state needs its own
  // flag to tell "the API said no listings" apart from "the API never answered".
  const load = useCallback(async () => {
    try { setListings(await api.listings()); setError(""); setLoadFailed(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setLoadFailed(true); }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20_000); return () => clearInterval(t); }, [load]);

  // The publisher claims a listing by naming the wallet that should be paid.
  async function savePrice(listing: Listing) {
    if (!wallet) return;
    setBusy(listing.id); setError(""); setNotice("");
    try {
      await api.setListingPrice(listing.id, { developerWallet: wallet, priceLamports: String(Math.round(Number(priceSol) * LAMPORTS_PER_SOL)) });
      setEditing(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }

  // Renting is a real SOL transfer to the publisher, then the backend verifies
  // that transaction on Devnet before recording the hire.
  async function rent(listing: Listing) {
    if (!connected?.signer || !listing.developerWallet) return;
    const durationHours = hoursFor(listing.id);
    const total = BigInt(listing.priceLamports) * BigInt(Math.ceil(durationHours / 24));
    setBusy(listing.id); setError(""); setNotice("");
    try {
      const result = await client.sendTransaction([transferSolInstruction(wallet, listing.developerWallet, total)]);
      const signature = String(result.context.signature);
      await api.hire({ listingId: listing.id, ownerWallet: wallet, durationHours, paymentSignature: signature });
      setNotice(`Rented ${listing.agentVersion.name} for ${durationHours}h · ${short(signature, 6)}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Rental payment was rejected or could not be verified."); } finally { setBusy(""); }
  }

  const filtered = listings.filter(l => {
    if (pricedOnly && Number(l.priceLamports) === 0) return false;
    if (search && !l.agentVersion.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="route-page page-marketplace space-y-8">
      <div className="route-local-heading">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}20` }}><Sparkles size={12} style={{ color: M }} /></div>
          <span className="text-[12px] font-bold tracking-[0.2em] uppercase" style={{ ...mono, color: M }}>Agent Marketplace · Devnet</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>Published <span style={{ color: M }}>Agent Versions</span></h1>
        <p className="text-sm mt-1 max-w-xl" style={{ ...sans, color: color.textDim, lineHeight: 1.7 }}>
          Every listing is a real, immutable agent version. Renting sends SOL to the publisher's wallet and is verified on Devnet before the agreement is recorded.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: color.textDim }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents by name..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-xs outline-none transition-all"
            style={{ ...sans, background: color.surface, border: `1px solid ${color.border}`, color: color.text, caretColor: M }} />
        </div>
        <button type="button" onClick={() => setPricedOnly(p => !p)} aria-pressed={pricedOnly}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={{ ...sans, background: pricedOnly ? `${M}12` : color.surface, border: `1px solid ${pricedOnly ? M + "35" : color.border}`, color: pricedOnly ? M : color.textDim }}>
          <ShieldCheck size={13} />Rentable only
          <div className="relative w-8 h-4 rounded-full ml-1" style={{ background: pricedOnly ? `${M}35` : color.border, border: `1px solid ${pricedOnly ? M + "50" : color.border}` }}>
            <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{ left: pricedOnly ? "calc(100% - 14px)" : 2, background: pricedOnly ? M : color.textDim }} />
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs" style={{ ...sans, color: color.textDim }}>Showing <span style={{ color: color.text }}>{filtered.length}</span> listing{filtered.length === 1 ? "" : "s"}</span>
        {error && <span className="text-[13px]" style={{ ...mono, color: color.danger }}>{error}</span>}
        {notice && <span className="text-[13px]" style={{ ...mono, color: M }}>{notice}</span>}
      </div>

      {/* A failed load must not read as "there is nothing here": telling
          someone to publish an agent when the API is unreachable sends them
          down the wrong path entirely. */}
      {filtered.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ ...glass() }}>
          {loadFailed ? (
            <>
              <p className="text-sm" style={{ ...sans, color: color.text }}>Could not load listings from the API.</p>
              <p className="text-[13px] mt-1" style={{ ...mono, color: color.textMuted }}>{API_URL} · {error}</p>
              <p className="text-[13px] mt-2" style={{ ...sans, color: color.textDim }}>If this says “Not Found”, the API is running a build without the marketplace routes.</p>
            </>
          ) : (
            <p className="text-sm" style={{ ...sans, color: color.textMuted }}>No listings yet — publish an agent from the Agents page and it appears here.</p>
          )}
        </div>
      )}

      <div className="market-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((l, idx) => {
          const accent = AGENT_ACCENTS[idx % AGENT_ACCENTS.length];
          const priced = Number(l.priceLamports) > 0 && !!l.developerWallet;
          const mine = !!wallet && l.developerWallet === wallet;
          return (
            <div key={`mkt-card-${l.id}`} id={`listing-${l.id}`}
              className="group relative rounded-2xl flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
              <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}70, transparent)` }} />
              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18`, border: `1px solid ${accent}25` }}>
                    <Bot size={18} style={{ color: accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold" style={{ ...sans, color: color.text }}>{l.agentVersion.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px]" style={{ ...mono, color: accent, opacity: 0.7 }}>{l.agentVersion.version}</span>
                      {l.activeHires > 0 && <span className="text-[12px] px-1.5 py-0.5 rounded-md" style={{ ...sans, background: `${M}10`, color: M, border: `1px solid ${M}18` }}>{l.activeHires} active hire{l.activeHires === 1 ? "" : "s"}</span>}
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ ...sans, color: color.textMuted, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.agentVersion.strategy}</p>
                <div className="rounded-xl px-3.5 py-3 space-y-1.5" style={{ background: color.bg, border: `1px solid ${color.border}` }}>
                  <div className="flex items-center justify-between"><span className="text-[11px] uppercase tracking-widest" style={{ ...sans, color: color.border }}>Agent hash</span><span className="text-[11px] uppercase tracking-widest" style={{ ...sans, color: color.border }}>Publisher</span></div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ ...mono, color: C }}>{short(l.agentVersion.agentHash, 6)}</span>
                    <span className="text-[12px]" style={{ ...mono, color: color.textDim }}>{l.developerWallet ? short(l.developerWallet) : "unclaimed"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={10} style={{ color: color.textDim }} />
                  <span className="text-[12px]" style={{ ...mono, color: color.textDim }}>published {new Date(l.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="px-6 py-4 border-t flex flex-col gap-3" style={{ borderColor: color.border, background: color.surfaceSubtle }}>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px]" style={{ ...sans, color: color.textDim }}>{priced ? `${fmtSol(l.priceLamports)} SOL per 24h` : "Rate"}</div>
                    <div className="text-base font-bold" style={{ ...mono, color: priced ? color.text : color.textDim }}>
                      {priced ? `${fmtSol(String(BigInt(l.priceLamports) * BigInt(periodsFor(l.id))))} SOL` : "no price set"}
                    </div>
                    {priced
                      ? <div className="text-[12px] mt-0.5" style={{ ...sans, color: color.textDim }}>total for {hoursFor(l.id)}h</div>
                      : <div className="text-[12px] mt-0.5" style={{ ...sans, color: color.textDim }}>Claim it to set a price and start renting</div>}
                  </div>
                  {priced && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] uppercase tracking-widest" style={{ ...sans, color: color.textDim }}>Duration</span>
                      <div className="flex gap-1">
                        {[24, 72, 168].map(h => (
                          <button type="button" key={`${l.id}-h${h}`} onClick={() => setHours(v => ({ ...v, [l.id]: h }))} aria-pressed={hoursFor(l.id) === h}
                            className="px-2 py-1 rounded-lg text-[12px] font-semibold transition-all"
                            style={{ ...mono, background: hoursFor(l.id) === h ? `${accent}18` : color.border, border: `1px solid ${hoursFor(l.id) === h ? accent + "35" : color.border}`, color: hoursFor(l.id) === h ? accent : color.textDim }}>
                            {h === 168 ? "7d" : h === 72 ? "3d" : "1d"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {mine && <div className="text-[12px]" style={{ ...sans, color: A }}>You publish this agent — you cannot rent it from yourself.</div>}
                {editing === l.id ? (
                  <div className="flex items-center gap-2">
                    <input value={priceSol} onChange={e => setPriceSol(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Rental price in SOL"
                      className="w-24 px-3 py-2 rounded-xl text-xs text-right" style={{ ...mono, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.text }} />
                    <button type="button" disabled={busy === l.id} onClick={() => savePrice(l)} className="flex-1 px-3 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-40" style={{ ...sans, background: `${M}14`, border: `1px solid ${M}30`, color: M }}>
                      {busy === l.id ? "Saving…" : "Save price"}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 rounded-xl text-[13px]" style={{ ...sans, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textDim }}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" disabled={!connected?.signer || !priced || busy === l.id || mine} onClick={() => rent(l)}
                      title={mine ? "You publish this agent" : !priced ? "The publisher has not set a price" : !connected?.signer ? "Connect a wallet to rent" : ""}
                      className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
                      style={{ ...sans, background: `${C}14`, border: `1px solid ${C}30`, color: C }}>
                      {busy === l.id ? "Paying…" : `Rent ${hoursFor(l.id)}h`}
                    </button>
                    {/* Shown unless the listing belongs to someone else — the
                        payout wallet is write-once, so offering "Claim" there
                        would only lead to a 403. An unclaimed listing always
                        keeps the button so the card is never a dead end. */}
                    {(mine || !l.developerWallet) && (
                      <button type="button" disabled={!wallet}
                        title={wallet ? "" : "Connect a wallet — it receives the rental payments"}
                        onClick={() => { setEditing(l.id); setPriceSol(priced ? String(Number(l.priceLamports) / LAMPORTS_PER_SOL) : "0.05"); }}
                        className="px-3 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40" style={{ ...sans, background: `${accent}12`, border: `1px solid ${accent}28`, color: accent }}>
                        {mine ? "Edit price" : "Claim"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <section className="market-list-table" style={{ ...glass() }}>
          <header><div><strong>All published versions</strong><span>{filtered.length} listing{filtered.length === 1 ? "" : "s"}</span></div><code>IMMUTABLE · agent hash = SHA-256(model | code | config)</code></header>
          <div className="market-list-head"><span>Agent</span><span>Hash</span><span>Publisher</span><span>Hires</span><span>Price</span><span /></div>
          {filtered.map((listing, index) => (
            <div className="market-list-row" key={`market-row-${listing.id}`}>
              <span><i style={{ color: AGENT_ACCENTS[index % AGENT_ACCENTS.length] }}><Bot size={13} /></i><b>{listing.agentVersion.name}</b><small>{listing.agentVersion.version}</small></span>
              <code>{short(listing.agentVersion.agentHash, 6)}</code>
              <code>{listing.developerWallet ? short(listing.developerWallet, 5) : "unclaimed"}</code>
              <span>{listing.activeHires || "new"}</span>
              <strong>{Number(listing.priceLamports) > 0 ? `${fmtSol(listing.priceLamports)} SOL` : "—"}</strong>
              <button type="button" onClick={() => document.getElementById(`listing-${listing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/* ── 5. VAULT ── */
function VaultPage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const [sol, setSol] = useState<number | null>(null);
  const [events, setEvents] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!owner) { setSol(null); setEvents([]); return; }
    let live = true;
    const load = async () => {
      try {
        const balance = await client.rpc.getBalance(address(owner)).send();
        if (live) setSol(Number(balance.value) / 1_000_000_000);
      } catch { if (live) setSol(null); }
      try {
        const rows = await api.audit();
        if (live) setEvents(rows.filter(r => r.actorType === "owner" || r.eventType.startsWith("chain.") || r.eventType === "vault.funded").slice(-8).reverse());
      } catch { /* the panel above already surfaces API errors */ }
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { live = false; clearInterval(t); };
  }, [client, owner]);

  return (
    <div className="route-page page-treasury space-y-8">
      <div className="route-local-heading">
        <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>Treasury</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>Solana Devnet · your wallet and the program-owned vault</p>
      </div>

      {/* Real program vault for the connected wallet */}
      <VaultPanel />

      {!owner && (
        <div className="rounded-2xl p-8 text-center" style={{ ...glass() }}>
          <p className="text-sm" style={{ ...sans, color: color.textMuted }}>Connect a wallet to see its balances and recent on-chain activity.</p>
        </div>
      )}

      {owner && (
        <>
          <div className="rounded-2xl p-7 relative overflow-hidden" style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
            <div className="absolute top-0 left-12 right-12 h-px" style={{ background: `linear-gradient(90deg, transparent, ${M}60, transparent)` }} />
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ ...mono, color: color.textDim }}>Wallet SOL Balance</div>
                <div className="text-4xl font-bold" style={{ ...mono, color: color.text }}>{sol === null ? "—" : `${sol.toFixed(4)} SOL`}</div>
                <div className="text-[13px] mt-2" style={{ ...sans, color: color.textDim }}>Devnet SOL · pays transaction fees</div>
              </div>
              <div className="text-right">
                <div className="text-xs mb-1" style={{ ...sans, color: color.textDim }}>Owner wallet</div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-sm font-semibold" style={{ ...mono, color: C }}>{short(owner)}</span>
                  <a href={explorerAddressUrl(owner)} target="_blank" rel="noreferrer" aria-label="Open wallet in Solana Explorer" className="p-1 rounded-md" style={{ background: color.surfaceInset, color: C }}><ExternalLink size={11} /></a>
                </div>
                <div className="text-[12px] mt-1" style={{ ...sans, color: color.textDim }}>Solana Devnet</div>
              </div>
            </div>
          </div>

          {/* Recent on-chain activity, straight from the audit trail */}
          <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: color.border }}>
              <span className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Recent Transactions</span>
            </div>
            {events.length === 0 && <div className="px-5 py-4 text-xs" style={{ ...sans, color: color.textDim }}>No on-chain activity recorded yet.</div>}
            {events.map(e => (
              <div key={e.id} className="px-5 py-3.5 border-b" style={{ borderColor: color.border }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ ...mono, background: `${C}12`, color: C, border: `1px solid ${C}22` }}>{e.eventType}</span>
                  <span className="text-[12px]" style={{ ...sans, color: color.textDim }}>{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                {e.chainSignature && (
                  <a href={explorerTransactionUrl(e.chainSignature)} target="_blank" rel="noreferrer" className="text-[12px]" style={{ ...mono, color: color.textDim }}>
                    {short(e.chainSignature, 8)} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── 7. SESSIONS ── */
function SessionsPage() {
  const [step, setStep] = useState(0);
  const [tokens, setTokens] = useState(["SOL", "USDC"]);
  const [cap, setCap] = useState(500);
  const [txn, setTxn] = useState(50);
  const [dur, setDur] = useState(24);
  const [cool, setCool] = useState(6);
  // Seeded from the demo ops wallet so the default flow still works, but the
  // destination allowlist is the product's headline promise — it belongs to
  // the owner, not to a build-time constant.
  const [dests, setDests] = useState<string[]>([DEMO_OPS_DESTINATION].filter(Boolean));
  const [agentVersions, setAgentVersions] = useState<AgentVersion[]>([]);
  const [agentId, setAgentId] = useState("");
  // Rentals this wallet holds. An agent someone else publishes and prices is
  // only grantable while a rental covers it — the API checks, this just lets
  // the wizard say so before the wallet is asked to sign.
  const [hires, setHires] = useState<Hire[]>([]);
  const wizardClient = useClient<AppClient>();
  const wizardWallet = useConnectedWallet(wizardClient);
  const wallet = wizardWallet ? String(wizardWallet.account.address) : "";
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [grantsKey, setGrantsKey] = useState(0);

  useEffect(() => {
    let live = true;
    api.agents()
      .then(list => { if (!live) return; setAgentVersions(list); setAgentId(prev => prev || list[0]?.id || ""); })
      .catch(() => { /* none published yet: the sign step publishes one from this policy */ });
    if (wallet) api.hires(wallet).then(h => { if (live) setHires(h); }).catch(() => { /* no rentals is not an error */ });
    return () => { live = false; };
  }, [grantsKey, wallet]);
  const tList = ["SOL", "USDC", "JUP", "JTO", "BONK", "PYTH"];
  const STEPS = ["Scope", "Spend Limits", "Time Bounds", "Review & Sign"];

  const cleanDests = [...new Set(dests.map(d => d.trim()).filter(Boolean))];
  const destError = dests.some(d => d.trim() && !isAddressLike(d.trim())) ? "One of these is not a valid Solana address."
    : cleanDests.length === 0 ? "Add at least one address the agent may pay."
    : cleanDests.length !== dests.filter(d => d.trim()).length ? "Duplicate destinations are ignored."
    : "";
  const destsInvalid = cleanDests.length === 0 || dests.some(d => d.trim() && !isAddressLike(d.trim()));

  // Which published agent version this grant authorises. The grant records it,
  // so picking the wrong one would put the wrong agentHash in the audit trail.
  const selectedAgent = agentVersions.find(a => a.id === agentId) ?? null;
  const activeHire = selectedAgent
    ? hires.find(h => h.listing?.agentVersionId === selectedAgent.id && new Date(h.endsAt) > new Date()) ?? null
    : null;
  const policy: AgentPolicyInput = {
    agentName: selectedAgent?.name ?? FALLBACK_AGENT.name,
    strategy: selectedAgent?.strategy ?? FALLBACK_AGENT.strategy,
    tokens,
    spendCapUsdc: cap,
    maxTransactions: txn,
    durationHours: dur,
    cooldownMinutes: cool,
  };

  // Destinations are part of the signed policy digest, so a change to them
  // invalidates the reviewed policy just as a cap change does.
  useEffect(() => {
    setAssessment(null);
    setAssessmentError("");
  }, [tokens, cap, txn, dur, cool, dests]);

  async function assessPolicy() {
    setAssessing(true);
    setAssessmentError("");
    try {
      setAssessment(await requestRiskAssessment(policy));
    } catch (error) {
      setAssessmentError(error instanceof Error ? error.message : "Unable to assess this policy.");
    } finally {
      setAssessing(false);
    }
  }


  function SliderCtl({ label, value, onChange, min, max, unit, accent }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string; accent: string }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div className="space-y-2.5">
        <div className="flex justify-between">
          <span className="text-xs" style={{ ...sans, color: color.textSecondary }}>{label}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ ...mono, color: accent, background: `${accent}12`, border: `1px solid ${accent}20` }}>{value.toLocaleString()}{unit}</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute left-0 right-0 h-1.5 rounded-full pointer-events-none" style={{ background: color.surfaceInset }} />
          <div className="absolute left-0 h-1.5 rounded-full pointer-events-none" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}60, ${accent})` }} />
          <input type="range" aria-label={label} min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className="absolute w-3.5 h-3.5 rounded-full border-2 transition-all pointer-events-none"
            style={{ left: `calc(${pct}% - 7px)`, background: color.surface, borderColor: accent, boxShadow: "0 2px 8px rgba(4, 2, 12, 0.7)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="route-page page-guardrails space-y-8">
      <div className="route-local-heading">
        <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>Agent Guardrails</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>Design bounded Solana policies, run AI risk checks, and publish verifiable proofs</p>
      </div>

      {/* Real grants from the REDLINE API (on-chain state via /grants/:id) */}
      <GrantsPanel refreshKey={grantsKey} />

      {/* Live transfer lane — replays the program's verdict for every proposal (SSE) */}
      <TransferLane />

      {/* New session wizard */}
      <div className="rounded-2xl overflow-hidden" style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: color.border, background: `${M}04` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}25` }}><Key size={12} style={{ color: M }} /></div>
            <span className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Create Agent Policy</span>
            <span className="ml-auto text-[12px] px-2 py-0.5 rounded-full font-semibold" style={{ ...mono, background: `${C}14`, color: C, border: `1px solid ${C}25` }}>SOLANA DEVNET</span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <button type="button" key={`wiz-step-${i}`} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined} aria-label={`Step ${i + 1}: ${s}`} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full h-0.5 rounded-full transition-all" style={{ background: i <= step ? (i === step ? M : `${M}50`) : color.border }} />
                <span className="text-[11px] font-semibold hidden sm:block" style={{ ...mono, color: i === step ? M : i < step ? `${M}60` : "rgba(148,163,184,0.35)" }}>
                  {String(i + 1).padStart(2, "0")} {s}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-6" style={{ minHeight: 240 }}>
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs" style={{ ...sans, color: color.textSecondary, lineHeight: 1.7 }}>Which published agent version does this grant authorise? The grant records its <code>agentHash</code>, so this is the build the policy is bound to.</p>
                {agentVersions.length > 0 ? (
                  <select value={agentId} onChange={e => setAgentId(e.target.value)} aria-label="Agent version this grant authorises"
                    className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
                    style={{ ...mono, background: color.surfaceSubtle, border: `1px solid ${color.border}`, color: color.text }}>
                    {agentVersions.map(a => (
                      <option key={a.id} value={a.id} style={{ background: color.surface }}>{a.name} {a.version} · {a.agentHash.slice(0, 8)}…</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[13px] px-3 py-2 rounded-xl" style={{ ...sans, background: `${A}0b`, border: `1px solid ${A}25`, color: color.warn }}>
                    No agent published yet — signing this grant publishes “{FALLBACK_AGENT.name}” and binds the grant to it. Publish from the Agents page first to name your own.
                  </p>
                )}
                {selectedAgent && <p className="text-[12px]" style={{ ...sans, color: color.textMuted, lineHeight: 1.6 }}>{selectedAgent.strategy}</p>}
                {activeHire && (
                  <p className="text-[12px] px-3 py-2 rounded-xl" style={{ ...sans, background: `${C}0b`, border: `1px solid ${C}25`, color: C, lineHeight: 1.6 }}>
                    Running under your rental of this agent — it covers grants until {new Date(activeHire.endsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. The grant records which rental authorised it.
                  </p>
                )}
              </div>
              <p className="text-xs" style={{ ...sans, color: color.textSecondary, lineHeight: 1.7 }}>Allowlist the SPL assets this agent may reference. Every other mint remains outside the signed policy.</p>
              <div className="flex flex-wrap gap-2">
                {tList.map((t, ti) => { const on = tokens.includes(t); return (
                  <button type="button" key={`wiz-tok-${ti}`} onClick={() => setTokens(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])} aria-pressed={on}
                    className="px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all"
                    style={{ ...mono, background: on ? `${M}14` : color.surfaceSubtle, border: `1px solid ${on ? M + "40" : color.border}`, color: on ? M : color.textMuted }}>
                    {t}
                  </button>
                ); })}
              </div>
              <div className="pt-1 space-y-2">
                <p className="text-xs" style={{ ...sans, color: color.textSecondary, lineHeight: 1.7 }}>Allowlist the addresses this agent may pay. The program checks every transfer against this list — an address that is not here cannot receive funds, whatever the agent proposes. Up to {MAX_DESTS}.</p>
                {dests.map((d, di) => (
                  <div key={`dest-${di}`} className="flex gap-2">
                    <input value={d} onChange={e => setDests(p => p.map((x, i) => i === di ? e.target.value.trim() : x))}
                      placeholder="Recipient address (base58)" aria-label={`Allowed destination ${di + 1}`} spellCheck={false}
                      className="flex-1 px-3 py-2 rounded-xl text-[13px] outline-none"
                      style={{ ...mono, background: color.surfaceSubtle, border: `1px solid ${d && !isAddressLike(d) ? "#ef444455" : color.border}`, color: color.text }} />
                    {dests.length > 1 && (
                      <button type="button" onClick={() => setDests(p => p.filter((_, i) => i !== di))} aria-label={`Remove destination ${di + 1}`}
                        className="px-3 rounded-xl text-[13px]" style={{ ...mono, background: color.surfaceSubtle, border: `1px solid ${color.border}`, color: color.textMuted }}>×</button>
                    )}
                  </div>
                ))}
                {dests.length < MAX_DESTS && (
                  <button type="button" onClick={() => setDests(p => [...p, ""])}
                    className="text-[13px] px-3 py-1.5 rounded-xl" style={{ ...mono, background: `${C}10`, border: `1px solid ${C}25`, color: C }}>+ Add destination</button>
                )}
                {destError && <p role="alert" className="text-[12px]" style={{ ...sans, color: color.danger }}>{destError}</p>}
              </div>
              <div className="rounded-xl p-3 flex gap-2.5" style={{ background: `${C}0a`, border: `1px solid ${C}18` }}>
                <Lock size={12} style={{ color: C, marginTop: 1, flexShrink: 0 }} />
                <p className="text-[13px]" style={{ ...sans, color: color.textSecondary, lineHeight: 1.6 }}>The policy digest binds token scope, the destination allowlist, spend cap, execution limit, cooldown, and validity window into one verifiable proof.</p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-xs" style={{ ...sans, color: color.textSecondary }}>Configure total spend ceiling and per-session transaction limits.</p>
              <SliderCtl label="Total Spend Cap" value={cap} onChange={setCap} min={10} max={10000} unit=" USDC" accent={A} />
              <SliderCtl label="Max Transactions / Session" value={txn} onChange={setTxn} min={1} max={500} unit=" txns" accent={C} />
              <div className="grid grid-cols-3 gap-2">
                {[{ label: "Avg/Tx", value: `$${(cap / txn).toFixed(2)}`, color: A }, { label: "Risk", value: cap > 5000 ? "HIGH" : cap > 1000 ? "MED" : "LOW", color: cap > 5000 ? color.danger : cap > 1000 ? A : M }, { label: "Tokens", value: String(tokens.length), color: C }].map((row, ri) => (
                  <div key={`wiz-row-${ri}`} className="rounded-xl p-3 text-center" style={{ background: color.surfaceSubtle, border: `1px solid ${color.border}` }}>
                    <div className="text-[12px] mb-1" style={{ ...sans, color: color.textMuted }}>{row.label}</div>
                    <div className="text-sm font-bold" style={{ ...mono, color: row.color }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-xs" style={{ ...sans, color: color.textSecondary }}>Set validity window and minimum cooldown between executions.</p>
              <SliderCtl label="Session Duration" value={dur} onChange={setDur} min={1} max={168} unit="h" accent={M} />
              <SliderCtl label="Execution Cooldown" value={cool} onChange={setCool} min={1} max={60} unit="m" accent={C} />
              <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: `${M}09`, border: `1px solid ${M}18` }}>
                <Timer size={14} style={{ color: M, flexShrink: 0 }} />
                <div>
                  <div className="text-[13px] font-semibold" style={{ ...mono, color: M }}>Expires {new Date(Date.now() + dur * 3600000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="text-[12px] mt-0.5" style={{ ...sans, color: color.textMuted }}>≤ {Math.floor((dur * 60) / cool)} executions · {cool}m cooldown</div>
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ ...sans, color: color.textSecondary }}>Review the bounded policy, run the risk copilot, then sign the on-chain grant. The program enforces these limits on every agent transfer.</p>
              <div>
              {[["Agent", selectedAgent ? `${selectedAgent.name} ${selectedAgent.version}` : `${FALLBACK_AGENT.name} (new)`, M], ["Rental", activeHire ? `until ${new Date(activeHire.endsAt).toLocaleDateString()}` : "not rented — yours to run", C], ["Token Scope", tokens.join(", "), C], ["Destinations", cleanDests.map(d => short(d, 6)).join(", ") || "none", A], ["Spend Cap", `${cap.toLocaleString()} USDC`, A], ["Max Txns", `${txn} transactions`, C], ["Duration", `${dur} hours`, M], ["Cooldown", `${cool} minutes`, M], ["Network", "Solana Devnet", C]].map(([k, v, col], ri) => (
                <div key={`rev-${ri}`} className="flex justify-between py-2.5 border-b" style={{ borderColor: color.border }}>
                  <span className="text-[13px]" style={{ ...sans, color: color.textMuted }}>{k}</span>
                  <span className="text-[13px] font-semibold" style={{ ...mono, color: col as string }}>{v}</span>
                </div>
              ))}
              </div>
              {assessment && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: `${assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : color.danger}0b`, border: `1px solid ${assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : color.danger}25` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: color.text }}>Risk copilot verdict</div>
                      <div className="text-[12px] mt-0.5" style={{ color: color.textMuted }}>{assessment.source === "openai" ? `OpenAI · ${assessment.model}` : assessment.source === "openai+deterministic-floor" ? `OpenAI + deterministic safety floor · ${assessment.model}` : "Deterministic safety fallback"}</div>
                    </div>
                    <div className="text-right"><div className="text-xl font-bold" style={{ ...mono, color: assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : color.danger }}>{assessment.score}/100</div><div className="text-[12px]" style={{ ...mono, color: color.textSecondary }}>{assessment.decision}</div></div>
                  </div>
                  <p className="text-[13px]" style={{ color: color.textSecondary }}>{assessment.summary}</p>
                  <ul className="space-y-1">{assessment.findings.slice(0, 3).map((finding, index) => <li key={`finding-${index}`} className="text-[12px] flex gap-2" style={{ color: color.textMuted }}><span style={{ color: C }}>•</span>{finding}</li>)}</ul>
                  <GrantSignButton policy={policy} assessment={assessment} destinations={cleanDests} destinationsInvalid={destsInvalid} agentVersionId={selectedAgent?.id ?? null} hireId={activeHire?.id ?? null} onCreated={() => setGrantsKey(k => k + 1)} />
                </div>
              )}
              {assessmentError && <p role="alert" className="text-[12px]" style={{ color: color.danger }}>{assessmentError}</p>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex gap-2" style={{ borderColor: color.border }}>
          <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-25"
            style={{ ...sans, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.textSecondary }}>Back</button>
          <button type="button" onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : void assessPolicy()} disabled={assessing}
            className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ ...sans, background: step === STEPS.length - 1 ? color.primary : `${M}12`, border: `1px solid ${step === STEPS.length - 1 ? color.primary : M + "35"}`, color: step === STEPS.length - 1 ? color.onAccent : M, boxShadow: step === STEPS.length - 1 ? "0 6px 18px rgba(167,139,250,0.28)" : "none" }}>
            {step === STEPS.length - 1 ? <><Shield size={12} />{assessing ? "Assessing policy…" : assessment ? "Re-run risk assessment" : "Run AI risk assessment"}</> : <>Continue <ChevronRight size={12} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 8. SETTINGS ── */
function SettingsPage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const wallet = connected ? String(connected.account.address) : "";
  const [health, setHealth] = useState<Health | null>(null);
  const [healthState, setHealthState] = useState<"checking" | "healthy" | "offline">("checking");
  const [activeTab, setActiveTab] = useState(0);
  const [depthEnabled, setDepthEnabled] = useState(true);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const tabs = [
    { label: "Network", detail: "Cluster · program · executor", icon: Network },
    { label: "Wallet & demo assets", detail: "Owner · mints · destinations", icon: Wallet },
    { label: "Policy invariants", detail: "What the program enforces", icon: Lock },
    { label: "Experience", detail: "Sound · depth · motion · language", icon: Sparkles },
  ];

  const testHealth = useCallback(async () => {
    setHealthState("checking");
    try {
      const result = await checkHealth();
      setHealth(result);
      setHealthState("healthy");
    } catch {
      setHealth(null);
      setHealthState("offline");
    }
  }, []);

  useEffect(() => {
    let live = true;
    checkHealth().then(h => {
      if (live) { setHealth(h); setHealthState("healthy"); }
    }).catch(() => {
      if (live) { setHealth(null); setHealthState("offline"); }
    });
    return () => { live = false; };
  }, []);

  const healthLabel = healthState === "checking" ? "checking" : healthState;

  function Row({ label, value, accent = M }: { label: string; value: string; accent?: string }) {
    return (
      <div className="flex items-center justify-between py-3 border-b gap-4" style={{ borderColor: color.border }}>
        <span className="text-xs shrink-0" style={{ ...sans, color: color.textSecondary }}>{label}</span>
        <span className="text-xs font-semibold text-right break-all" style={{ ...mono, color: accent }}>{value}</span>
      </div>
    );
  }

  return (
    <div className="route-page page-settings">
      <div className="route-local-heading">
        <h1 className="text-2xl font-bold" style={{ ...sans, color: color.text }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>Live configuration of this REDLINE deployment</p>
      </div>
      <div className="settings-artifact-shell">
        <aside className="settings-artifact-nav" style={{ ...glass() }}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button type="button" role="tab" key={tab.label} onClick={() => setActiveTab(index)} aria-selected={activeTab === index}>
                <span><Icon size={16} /></span><span><strong>{tab.label}</strong><small>{tab.detail}</small></span><ChevronRight size={14} />
              </button>
            );
          })}
          <div className="settings-backend-anchor"><i className={health ? "is-live" : ""} /><span>Backend anchor · devnet · {healthLabel}</span></div>
        </aside>

        <section className="settings-artifact-panel" style={{ ...glass() }}>
          {activeTab === 0 && (
            <>
              <header><div><span>NETWORK</span><h2>Network</h2></div><em className={health ? "is-live" : ""}><i />{healthLabel.toUpperCase()}</em></header>
              <div className="settings-choice-row"><span>Cluster</span><div><button type="button" aria-pressed>Devnet</button><button type="button" disabled>Testnet</button><button type="button" disabled>Mainnet-beta</button></div></div>
              <Row label="Program" value={health?.programId ?? PROGRAM_ID} accent={C} />
              <Row label="Executor" value={health?.executor ?? (healthState === "checking" ? "checking…" : "unreachable")} accent={health ? C : healthState === "checking" ? color.textMuted : color.danger} />
              <div className="settings-choice-row"><span>Commitment</span><div><button type="button">processed</button><button type="button" aria-pressed>confirmed</button><button type="button">finalized</button></div></div>
              <label className="settings-api-row"><span>API URL</span><div><input readOnly value={API_URL} /><button type="button" onClick={() => void testHealth()} disabled={healthState === "checking"}>{healthState === "checking" ? "Testing…" : "Test"}</button></div></label>
            </>
          )}

          {activeTab === 1 && (
            <>
              <header><div><span>OWNER SESSION</span><h2>Wallet & demo assets</h2></div><em className={wallet ? "is-live" : ""}><i />{wallet ? "CONNECTED" : "NOT CONNECTED"}</em></header>
              <div className="settings-wallet-card"><span><Wallet size={22} /></span><div><strong>{wallet ? "Connected wallet" : "Wallet required"}</strong><code>{wallet || "Connect through Wallet Standard in the top bar"}</code></div>{wallet && <a href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a>}</div>
              <Row label="Demo USDC mint" value={import.meta.env.VITE_DEMO_USDC_MINT ? String(import.meta.env.VITE_DEMO_USDC_MINT) : "not configured"} accent={import.meta.env.VITE_DEMO_USDC_MINT ? C : A} />
              <Row label="Demo destination" value={DEMO_OPS_DESTINATION || "not configured"} accent={DEMO_OPS_DESTINATION ? C : A} />
              <Row label="Frontend write key" value={import.meta.env.VITE_API_KEY ? "configured" : "open (local/mock)"} accent={import.meta.env.VITE_API_KEY ? M : A} />
            </>
          )}

          {activeTab === 2 && (
            <>
              <header><div><span>PROGRAM BOUNDARY</span><h2>Policy invariants</h2></div><em className="is-live"><i />ON-CHAIN</em></header>
              <Row label="Gates enforced in order" value="7" />
              <Row label="Policy digest" value="SHA-256" />
              <Row label="Allowlist ceiling" value="4 mints · 4 destinations" accent={C} />
              <Row label="Revocation authority" value="owner signature" accent={C} />
              <Row label="Execution behavior" value="first failed gate stops atomically" accent={A} />
              <div className="settings-policy-note"><ShieldCheck size={16} /><p>Each grant is revoked separately because the on-chain program accepts one owner-signed revocation per policy account.</p></div>
            </>
          )}

          {activeTab === 3 && (
            <>
              <header><div><span>LOCAL PREFERENCES</span><h2>Experience</h2></div><em><i />THIS DEVICE</em></header>
              <button type="button" className="settings-toggle-row" onClick={() => setDepthEnabled(v => !v)} aria-pressed={depthEnabled}><span><strong>3D depth</strong><small>Perspective, stepped shadows and spatial panels</small></span><i /></button>
              <button type="button" className="settings-toggle-row" onClick={() => setMotionEnabled(v => !v)} aria-pressed={motionEnabled}><span><strong>Motion</strong><small>Page transitions, hover lift and live signals</small></span><i /></button>
              <div className="settings-experience-note"><Sparkles size={16} /><p>Sound remains available from the global header so it follows you across every page.</p></div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ROOT LAYOUT
══════════════════════════════════════════════════════════════ */
const PAGES = [ProtocolExperience, AgentsPage, AnalyticsPage, MarketplacePage, VaultPage, AuditPage, SessionsPage, SettingsPage, GuidePage, CopilotPage, ModelsPage, ProfilePage];

export default function App() {
  const indexFromHash = () => {
    const slug = window.location.hash.replace(/^#\/?/, "");
    const index = NAV.findIndex(item => item.slug === slug);
    return index < 0 ? 0 : index;
  };
  const [nav, setNav] = useState(indexFromHash);
  const previousNav = useRef(nav);
  const direction = FLOW_ORDER.indexOf(nav as (typeof FLOW_ORDER)[number]) - FLOW_ORDER.indexOf(previousNav.current as (typeof FLOW_ORDER)[number]);
  const mainRef = useRef<HTMLElement | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">(() => {
    try { return localStorage.getItem("redline.density") === "compact" ? "compact" : "comfortable"; }
    catch { return "comfortable"; }
  });
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const Page = PAGES[nav] as React.ComponentType<{ setNav?: (n: number) => void }>;

  useEffect(() => {
    const sync = () => { setNav(indexFromHash()); setMobileMenuOpen(false); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useLayoutEffect(() => {
    // Each route is a separate reading/task surface. Carrying the previous
    // route's internal scroll position makes a freshly opened page appear
    // cropped or incorrectly scaled beneath the fixed header.
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    previousNav.current = nav;
  }, [nav]);

  useEffect(() => { document.title = `${NAV[nav].label} · REDLINE`; }, [nav]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(open => !open);
      }
      if (event.key === "Escape") { setCommandOpen(false); setMobileMenuOpen(false); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setHeaderScrolled(el.scrollTop > 12);
    // Route changes reset the scroll position without always emitting a scroll
    // event, so read the position directly rather than waiting to be told.
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [nav]);

  const navigate = (index: number) => {
    setMobileMenuOpen(false);
    if (index === nav) mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (index !== nav) playSound("navigate");
    setNav(index);
    window.location.hash = `/${NAV[index].slug}`;
  };
  const toggleDensity = () => {
    setDensity(current => {
      const next = current === "comfortable" ? "compact" : "comfortable";
      try { localStorage.setItem("redline.density", next); } catch { /* density still works for this session */ }
      return next;
    });
  };
  const commandDescriptions: Record<string, string> = {
    protocol: "Protocol story, live backbone and evidence",
    marketplace: "Discover and rent published agent versions",
    agents: "Inspect agents, grants and active versions",
    guardrails: "Create bounded policies and signed permissions",
    treasury: "Review vault balances and recent transactions",
    audit: "Verify every intent, decision and signature",
    analytics: "Understand execution volume and policy outcomes",
    settings: "Inspect network and deployment configuration",
    copilot: "Ask grounded questions about grants, gates and evidence",
    models: "Measure the configured assistant and its trust boundary",
    profile: "Review the connected owner's on-chain operating identity",
  };
  const commandItems: CommandItem[] = FLOW_ORDER.map((pageIndex, position) => {
    const item = NAV[pageIndex];
    return {
      label: item.label,
      description: commandDescriptions[item.slug],
      shortcut: position === 0 ? "HOME" : `0${position}`,
      icon: item.icon,
      onSelect: () => navigate(pageIndex),
    };
  });
  const flowPosition = FLOW_ORDER.indexOf(nav as (typeof FLOW_ORDER)[number]);
  const previousPage = flowPosition > 0 ? FLOW_ORDER[flowPosition - 1] : null;
  const nextPage = flowPosition >= 0 && flowPosition < FLOW_ORDER.length - 1 ? FLOW_ORDER[flowPosition + 1] : null;
  const CurrentRouteIcon = NAV[nav].icon;

  return (
    <div data-density={density} className={`redline-app ${nav === 0 ? "redline-app-home" : ""} min-h-screen w-full flex flex-col overflow-hidden`} style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes redline-shimmer { 0% { left: -60px; } 100% { left: calc(100% + 60px); } }
        @keyframes redline-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes redline-scan { 0% { top:-2%; } 100% { top:102%; } }
        input[type=range] { -webkit-appearance: none; appearance: none; }
      `}</style>

      {nav !== 0 && <SpatialBackdrop />}

      {/* ── Main ── */}
      <div className="app-shell flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden w-full" style={{ position: "relative", zIndex: 1 }}>
        {/* Topbar */}
        <header className={`app-header relative z-50 flex shrink-0 items-center gap-3 px-3 sm:px-6 py-3${headerScrolled ? " header-scrolled" : ""}`}
          style={{ background: "rgba(238,243,249,0.90)", backdropFilter: "blur(22px)", borderBottom: `1px solid ${color.border}` }}>
          <button type="button" onClick={() => navigate(0)} className="flex shrink-0 items-center gap-2.5" aria-label="Open REDLINE protocol experience">
            <span className="grid h-8 w-8 place-items-center rounded-full" style={{ color: M, border: `1px solid ${M}55`, background: `${M}10` }}>
              <ShieldCheck size={14} />
            </span>
            <span className="hidden sm:block text-[13px] font-bold tracking-[0.2em]" style={{ ...mono, color: color.text }}>REDLINE</span>
          </button>

          <button type="button" className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(open => !open)} aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}<span>Explore</span>
          </button>
          {mobileMenuOpen && <nav id="mobile-navigation" className="mobile-nav-panel" aria-label="Mobile navigation">
            {HEADER_ORDER.map(index => <button type="button" key={NAV[index].slug} onClick={() => navigate(index)} aria-current={nav === index ? "page" : undefined}>{NAV[index].label}<ArrowRight size={14} /></button>)}
          </nav>}

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 sm:px-3" aria-label="Primary navigation">
            {HEADER_ORDER.map(index => {
              const item = NAV[index];
              const active = nav === index;
              return (
                <button
                  type="button"
                  key={item.slug}
                  onClick={() => navigate(index)}
                  aria-current={active ? "page" : undefined}
                  className="relative shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors"
                  style={{ ...sans, color: active ? color.primaryText : color.textDim, background: active ? "rgba(75,134,247,0.09)" : "transparent" }}
                >
                  {item.label}
                  {active && <motion.span layoutId="primary-nav-indicator" className="absolute inset-x-3 -bottom-[13px] h-px" style={{ background: M, boxShadow: `0 0 14px ${M}` }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                </button>
              );
            })}
          </nav>

          <button type="button" className="header-tool header-command-trigger" onClick={() => setCommandOpen(true)} aria-label="Open command palette">
            <Search size={13} /><span>Find</span><kbd>⌘K</kbd>
          </button>
          <button type="button" className="header-tool header-density-trigger" onClick={toggleDensity} aria-label={`Use ${density === "comfortable" ? "compact" : "comfortable"} density`}>
            <Rows3 size={13} /><span>{density === "comfortable" ? "Comfort" : "Compact"}</span>
          </button>
          <SoundControl />

          <div className="hidden xl:flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.14em]" style={{ ...mono, color: color.textDim }}>
            <span className="redline-live-dot h-1.5 w-1.5 rounded-full" style={{ background: M }} />
            Solana devnet
          </div>
          <SolanaWalletControl />
          <button type="button" className="header-profile-link" onClick={() => navigate(11)} aria-label="Open owner profile" aria-current={nav === 11 ? "page" : undefined}>
            <Wallet size={15} />
          </button>
        </header>

        {/* Page content */}
        <main ref={mainRef} aria-label={`${NAV[nav].label} page`} className={`app-main flex-1 overflow-y-auto ${nav === 0 ? "app-main-home" : "px-3 sm:px-5 lg:px-8 py-5 lg:py-7"}`}>
          <div data-route={NAV[nav].slug} className={nav === 0 ? "w-full" : "mx-auto w-full max-w-[1600px]"}>
            {nav !== 0 && (
              <div className="route-flow-bar" aria-label="Product journey navigation">
                <div className="route-flow-index" aria-hidden="true">
                  <CurrentRouteIcon size={18} />
                  <span>{String(flowPosition + 1).padStart(2, "0")}<b>/</b>{String(FLOW_ORDER.length).padStart(2, "0")}</span>
                </div>
                <div className="route-flow-context">
                  <div className="route-flow-current">
                    <strong>{NAV[nav].label}</strong>
                    <p>{commandDescriptions[NAV[nav].slug]}</p>
                  </div>
                  <div className="route-flow-track" aria-label="Journey steps">
                    {FLOW_ORDER.map((pageIndex, position) => (
                      <button
                        type="button"
                        key={NAV[pageIndex].slug}
                        className={nav === pageIndex ? "is-active" : ""}
                        data-complete={position < flowPosition}
                        onClick={() => navigate(pageIndex)}
                        aria-label={`Artboard ${position + 1}: ${NAV[pageIndex].label}`}
                        aria-current={nav === pageIndex ? "step" : undefined}
                        title={NAV[pageIndex].label}
                      >
                        <span />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="route-flow-pager">
                  {previousPage !== null && previousPage !== 0 && (
                    <button type="button" onClick={() => navigate(previousPage)} aria-label={`Previous: ${NAV[previousPage].label}`}>
                      <ArrowLeft size={13} /><span><small>PREVIOUS</small>{NAV[previousPage].label}</span>
                    </button>
                  )}
                  {nextPage !== null && (
                    <button type="button" onClick={() => navigate(nextPage)} aria-label={`Next: ${NAV[nextPage].label}`}>
                      <span><small>NEXT</small>{NAV[nextPage].label}</span><ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
            <PageTransition pageKey={NAV[nav].label} direction={direction} home={nav === 0}>
              <div className={nav === 0 ? "protocol-view" : "route-page-stage"}>
                {nav !== 0 && <RouteScene icon={NAV[nav].icon} label={NAV[nav].label} scene={NAV[nav].slug} />}
                <Page setNav={navigate} />
              </div>
            </PageTransition>
          </div>
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} items={commandItems} />
    </div>
  );
}
