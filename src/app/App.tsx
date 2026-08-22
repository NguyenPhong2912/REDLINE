import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Bot, BarChart3, Globe, Wallet, Shield,
  Layers, Settings, Zap, ChevronRight, Search, ShieldCheck,
  Star, Activity, ArrowUpRight, ArrowDownRight, Sparkles,
  Filter, ArrowDownUp, Eye, Key, Timer, Lock, Bell,
  TrendingUp, Cpu, DollarSign, CheckCircle2, AlertTriangle,
  RefreshCw, Clock, Network, Copy, ExternalLink, Terminal,
  ToggleLeft, ToggleRight, User, Palette, Globe2, ChevronDown,
  Plus, Trash2, Edit3, MoreHorizontal, Download, Upload,
  PieChart, LineChart as LineChartIcon, BarChart2, Circle,
  Wifi, WifiOff, Info, X, Check,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RPie,
  Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";
import { PolicyProofButton } from "./components/PolicyProofButton";
import { SolanaWalletControl } from "./components/SolanaWalletControl";
import {
  requestRiskAssessment,
  type AgentPolicyInput,
  type RiskAssessment,
} from "./lib/risk-engine";

/* ── palette ── */
const M = "#00ffc4";
const C = "#06b6d4";
const A = "#e2b714";
const BG = "#040707";
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const sans: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };

/* ── glass helper ── */
const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "rgba(11,17,16,0.6)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.05)",
  ...extra,
});

/* ── chart tooltip ── */
function ChartTip({ active, payload, color = M, prefix = "", suffix = "" }: { active?: boolean; payload?: { value: number }[]; color?: string; prefix?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-2.5 py-1.5 rounded-lg text-[11px]" style={{ ...mono, background: "#0d1a18", border: `1px solid ${color}28`, color }}>
      {prefix}{Number(payload[0].value).toLocaleString()}{suffix}
    </div>
  );
}

/* ── shared data ── */
const perfWeek = [
  { t: "Mon", v: 142, vol: 14200, fee: 320 },
  { t: "Tue", v: 198, vol: 19800, fee: 480 },
  { t: "Wed", v: 167, vol: 16400, fee: 390 },
  { t: "Thu", v: 231, vol: 23100, fee: 610 },
  { t: "Fri", v: 287, vol: 28700, fee: 740 },
  { t: "Sat", v: 213, vol: 21300, fee: 520 },
  { t: "Sun", v: 315, vol: 31500, fee: 820 },
];
const latencyData = [
  { t: "00:00", v: 180 }, { t: "04:00", v: 155 }, { t: "08:00", v: 210 },
  { t: "12:00", v: 130 }, { t: "16:00", v: 142 }, { t: "20:00", v: 118 }, { t: "Now", v: 125 },
];
const pieData = [
  { name: "DeFi Trading", value: 42, color: M },
  { name: "Yield", value: 28, color: A },
  { name: "Oracle", value: 18, color: C },
  { name: "Risk", value: 12, color: "#8b5cf6" },
];

const AGENTS_DATA = [
  { id: 1, name: "QuantPilot", tag: "DeFi Trading", pnl: "+$4,821", pnlN: 4821, up: true, status: "ACTIVE", exp: "01:42:18", apy: "12.4%", ops: 12847, winRate: 94.2, uptime: 99.8, accent: M, hash: "7Aqv…fK3p" },
  { id: 2, name: "RouteScout", tag: "Cross-DEX", pnl: "+$1,203", pnlN: 1203, up: true, status: "ACTIVE", exp: "04:11:03", apy: "8.7%", ops: 8203, winRate: 91.8, uptime: 98.9, accent: C, hash: "9Nm2…Qx7d" },
  { id: 3, name: "SignalOracle", tag: "Oracle", pnl: "+$390", pnlN: 390, up: true, status: "ACTIVE", exp: "00:28:44", apy: "—", ops: 5829, winRate: 85.3, uptime: 99.1, accent: "#8b5cf6", hash: "4Ytp…mR8a" },
  { id: 4, name: "YieldGuard", tag: "Yield", pnl: "-$142", pnlN: -142, up: false, status: "PAUSED", exp: "EXPIRED", apy: "8.74%", ops: 4102, winRate: 88.7, uptime: 99.6, accent: A, hash: "2Kzw…vH6n" },
  { id: 5, name: "RiskSentinel", tag: "Risk Monitor", pnl: "$0", pnlN: 0, up: true, status: "IDLE", exp: "12:00:00", apy: "—", ops: 41002, winRate: 97.1, uptime: 100, accent: C, hash: "6Fsa…pT4c" },
];

const MARKETPLACE_AGENTS = [
  { id: 1, name: "QuantPilot", version: "v1.2.0", tag: "DeFi Trading", desc: "Guardrailed momentum agent with pre-trade simulation, Jupiter route checks, and explicit spend limits.", hash: "7Aqv…fK3p", deployer: "3Gds…nE9u", winRate: 94.2, apy: 18.4, latency: 84, executions: "12,847", uptime: 99.8, verified: true, featured: true, price: "1.20 SOL", rent: "0.04 SOL/day", accent: M, accentB: C, tags: ["Jupiter", "Simulation", "Devnet"], stars: 4.9, reviews: 312 },
  { id: 2, name: "YieldGuard", version: "v1.1.0", tag: "Yield Optimizer", desc: "Policy-bounded yield monitor that proposes rebalances and pauses when liquidity or oracle risk rises.", hash: "2Kzw…vH6n", deployer: "8Tqm…sL2j", winRate: 88.7, apy: 14.9, latency: 142, executions: "8,203", uptime: 99.6, verified: true, featured: false, price: "0.85 SOL", rent: "0.03 SOL/day", accent: A, accentB: "#f59e0b", tags: ["Yield", "Human Review", "SPL"], stars: 4.7, reviews: 198 },
  { id: 3, name: "RiskSentinel", version: "v1.5.0", tag: "Risk Monitor", desc: "AI-assisted policy analyzer with deterministic fallback, anomaly scoring, and automatic block verdicts.", hash: "6Fsa…pT4c", deployer: "9Nm2…Qx7d", winRate: 97.1, apy: 0, latency: 31, executions: "41,002", uptime: 100, verified: true, featured: false, price: "0.60 SOL", rent: "0.02 SOL/day", accent: C, accentB: "#3b82f6", tags: ["Risk AI", "Guardrails", "Alerts"], stars: 4.95, reviews: 541 },
  { id: 4, name: "RouteScout", version: "v1.3.0", tag: "DeFi Trading", desc: "Cross-DEX route observer that surfaces price differences but requires policy approval before execution.", hash: "9Nm2…Qx7d", deployer: "4Ytp…mR8a", winRate: 91.8, apy: 20.3, latency: 67, executions: "19,441", uptime: 98.9, verified: true, featured: false, price: "1.45 SOL", rent: "0.05 SOL/day", accent: M, accentB: C, tags: ["Cross-DEX", "Allowlist", "Cooldown"], stars: 4.8, reviews: 267 },
  { id: 5, name: "SignalOracle", version: "v1.2.0", tag: "Oracle & Data", desc: "LLM-assisted signal summarizer that cites inputs and publishes only policy digests, never private prompts.", hash: "4Ytp…mR8a", deployer: "6Fsa…pT4c", winRate: 85.3, apy: 6.2, latency: 210, executions: "5,829", uptime: 99.1, verified: false, featured: false, price: "0.70 SOL", rent: "0.025 SOL/day", accent: "#8b5cf6", accentB: C, tags: ["AI", "Signals", "Oracle"], stars: 4.6, reviews: 94 },
  { id: 6, name: "TreasuryPilot", version: "v1.0.0", tag: "Cross-Chain", desc: "Treasury workflow agent that proposes Solana actions with approval gates and tamper-evident policy proofs.", hash: "5Jrc…wB1z", deployer: "7Aqv…fK3p", winRate: 96.4, apy: 9.4, latency: 190, executions: "7,112", uptime: 99.4, verified: true, featured: false, price: "1.10 SOL", rent: "0.04 SOL/day", accent: C, accentB: "#06b6d4", tags: ["Treasury", "Approvals", "Proofs"], stars: 4.75, reviews: 163 },
];

const CATS = ["All Agents", "DeFi Trading", "Yield Optimizer", "Oracle & Data", "Risk Monitor", "NFT Strategy", "Cross-Chain", "AI Inference"];

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Bot, label: "Agents", badge: "5" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Globe, label: "Marketplace" },
  { icon: Wallet, label: "Treasury" },
  { icon: Shield, label: "Security" },
  { icon: Layers, label: "Guardrails" },
  { icon: Settings, label: "Settings" },
];

/* ── reusable components ── */
function StatBar({ value, color, height = 1.5 }: { value: number; color: string; height?: number }) {
  return (
    <div className="relative rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", height }}>
      <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}60, ${color})`, boxShadow: `0 0 8px ${color}40` }} />
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const col = status === "ACTIVE" ? M : status === "PAUSED" ? A : "#64748b";
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{ ...mono, background: `${col}12`, color: col, border: `1px solid ${col}25` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col, boxShadow: status === "ACTIVE" ? `0 0 6px ${col}` : "none", animation: status === "ACTIVE" ? "redline-pulse 2s infinite" : "none" }} />
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, up, accent, icon: Icon, data, gradId }: { label: string; value: string; sub: string; up: boolean; accent: string; icon: React.ElementType; data: { t: string; v: number }[]; gradId: string }) {
  return (
    <div className="relative rounded-2xl p-5 flex flex-col gap-3 overflow-hidden group transition-transform duration-300 hover:-translate-y-0.5"
      style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at 20% 0%, ${accent}10 0%, transparent 60%)` }} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${accent}14`, border: `1px solid ${accent}20` }}>
            <Icon size={13} style={{ color: accent }} />
          </div>
          <span className="text-xs font-medium" style={{ ...sans, color: "#94a3b8" }}>{label}</span>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ ...mono, color: up ? M : "#ef4444" }}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{sub}
        </span>
      </div>
      <div className="text-3xl font-bold tracking-tighter" style={{ ...mono, color: "#e2e8f0", textShadow: `0 0 24px ${accent}30` }}>{value}</div>
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
            <Tooltip content={<ChartTip color={accent} />} />
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
      <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ ...sans, color: "#94a3b8" }}>{text}</span>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.07), transparent)" }} />
    </div>
  );
}

function ShimmerBtn({ label, accent, full, size = "sm" }: { label: string; accent: string; full?: boolean; size?: "xs" | "sm" }) {
  const [hov, setHov] = useState(false);
  return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className={`relative flex items-center justify-center gap-1.5 rounded-xl font-semibold overflow-hidden transition-all duration-300 active:scale-[0.97] ${full ? "flex-1" : ""} ${size === "xs" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2.5 text-xs"}`}
      style={{ ...sans, background: hov ? `${accent}20` : `${accent}12`, border: `1px solid ${accent}${hov ? "50" : "28"}`, color: hov ? "#e2e8f0" : accent, boxShadow: hov ? `0 0 24px ${accent}28` : "none" }}>
      {hov && <span className="absolute inset-y-0 w-12 -skew-x-12 pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`, animation: "redline-shimmer 0.55s ease forwards" }} />}
      {label}
    </button>
  );
}

/* ── Particle Canvas ── */
function ParticleGrid() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const cols = Math.ceil(c.width / 56), rows = Math.ceil(c.height / 56);
    const pts = Array.from({ length: (cols + 1) * (rows + 1) }, (_, i) => ({
      x: (i % (cols + 1)) * 56, y: Math.floor(i / (cols + 1)) * 56,
      p: Math.random() * Math.PI * 2, s: 0.004 + Math.random() * 0.006,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "rgba(0,255,196,0.025)"; ctx.lineWidth = 0.5;
      for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * 56, 0); ctx.lineTo(i * 56, c.height); ctx.stroke(); }
      for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * 56); ctx.lineTo(c.width, j * 56); ctx.stroke(); }
      pts.forEach(p => { p.p += p.s; ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,255,196,${0.06 + 0.1 * (0.5 + 0.5 * Math.sin(p.p))})`; ctx.fill(); });
      raf = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

/* ════════════════════════════════════════════════════════════
   PAGE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── 1. DASHBOARD ── */
function DashboardPage() {
  const logs = [
    { type: "success", text: "QuantPilot › simulation passed · route within policy", ts: "20:41:14" },
    { type: "exec",    text: "RouteScout › Jupiter quote · 12.4 SOL → 1,847 USDC", ts: "20:41:12" },
    { type: "warn",    text: "Policy account expires in 01:42 · review queued", ts: "20:41:10" },
    { type: "success", text: "SignalOracle › policy digest published to Memo", ts: "20:41:08" },
    { type: "info",    text: "YieldGuard › proposal created · 847.2 USDC", ts: "20:41:06" },
    { type: "exec",    text: "RiskSentinel › scan(slot=401847412)", ts: "20:41:03" },
    { type: "success", text: "Policy proof confirmed · Devnet · 5,000 lamports", ts: "20:41:01" },
  ];
  const logCol: Record<string, string> = { info: "#64748b", success: M, exec: C, warn: A };

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}20` }}><Sparkles size={12} style={{ color: M }} /></div>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ ...mono, color: M }}>REDLINE Overview</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Autonomous finance. <span style={{ color: M }}>Hard limits.</span></h1>
        <p className="text-sm mt-1" style={{ ...sans, color: "#475569" }}>Design agent permissions, assess operational risk, and anchor policy proofs on Solana.</p>
        <span className="inline-flex mt-3 text-[9px] px-2 py-1 rounded-full tracking-widest" style={{ ...mono, color: A, background: `${A}10`, border: `1px solid ${A}25` }}>PROTOTYPE · ANALYTICS BELOW USE SIMULATED DATA</span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Active Agents" value="5" sub="+2 this week" up icon={Bot} accent={M} data={[{ t: "a", v: 2 }, { t: "b", v: 3 }, { t: "c", v: 3 }, { t: "d", v: 4 }, { t: "e", v: 4 }, { t: "f", v: 5 }, { t: "g", v: 5 }]} gradId="kpi-agents" />
        <KpiCard label="Total P&L" value="$6,272" sub="+18.4% today" up icon={DollarSign} accent={A} data={perfWeek.map(d => ({ t: d.t, v: d.vol / 5 }))} gradId="kpi-pnl" />
        <KpiCard label="Avg. Latency" value="125ms" sub="−18ms vs avg" up={false} icon={Cpu} accent={C} data={latencyData} gradId="kpi-lat" />
        <KpiCard label="Success Rate" value="98.6%" sub="71,983 ops" up icon={CheckCircle2} accent={M} data={perfWeek.map(d => ({ t: d.t, v: 95 + Math.random() * 4 }))} gradId="kpi-success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
        {/* Volume chart */}
        <div className="rounded-2xl p-5" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Weekly Execution Volume</div>
              <div className="text-[11px] mt-0.5" style={{ ...sans, color: "#475569" }}>USD settled on-chain · all agents</div>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ ...mono, color: A }}><ArrowUpRight size={13} />+48.3% WoW</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfWeek} barSize={24}>
                <defs>
                  <linearGradient id="bar-vol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={M} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={M} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip color={M} prefix="$" />} />
                <Bar dataKey="vol" fill="url(#bar-vol)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie distribution */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
          <div className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Strategy Mix</div>
          <div className="flex justify-center">
            <RPie width={140} height={140}>
              <Pie data={pieData} cx={65} cy={65} innerRadius={44} outerRadius={65} dataKey="value" strokeWidth={0}>
                {pieData.map((d, i) => <Cell key={`pc-${i}`} fill={d.color} opacity={0.85} />)}
              </Pie>
            </RPie>
          </div>
          <div className="space-y-2">
            {pieData.map((d, i) => (
              <div key={`pie-leg-${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[11px]" style={{ ...sans, color: "#94a3b8" }}>{d.name}</span>
                </div>
                <span className="text-[11px] font-semibold" style={{ ...mono, color: d.color }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity log + quick agent list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Log */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(1,3,3,0.5)" }}>
            <div className="flex gap-1.5">{["#ef4444", A, M].map((c, i) => <div key={`dot-${i}`} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />)}</div>
            <Terminal size={11} style={{ color: M }} />
            <span className="text-[11px]" style={{ ...mono, color: "#94a3b8" }}>runtime · simulated feed</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: M, animation: "redline-pulse 2s infinite" }} />
              <span className="text-[10px] font-bold" style={{ ...mono, color: M }}>SIM</span>
            </div>
          </div>
          <div className="p-4 space-y-2" style={{ background: "#010303" }}>
            {logs.map((l, i) => (
              <div key={`log-${i}`} className="flex gap-3 text-[11px]" style={mono}>
                <span style={{ color: "rgba(148,163,184,0.3)", minWidth: 52 }}>{l.ts}</span>
                <span style={{ color: logCol[l.type] ?? "#64748b" }}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick agents */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>My Agents</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: `${M}14`, color: M, border: `1px solid ${M}25` }}>5 running</span>
          </div>
          {AGENTS_DATA.map((a, i) => (
            <div key={`dash-agent-${a.id}`} className="flex items-center gap-3 px-5 py-3 border-b hover:bg-white/[0.018] transition-colors"
              style={{ borderColor: i < AGENTS_DATA.length - 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.accent}12`, border: `1px solid ${a.accent}22` }}>
                <Bot size={14} style={{ color: a.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ ...sans, color: "#e2e8f0" }}>{a.name}</div>
                <div className="text-[10px]" style={{ ...sans, color: "#475569" }}>{a.tag}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold" style={{ ...mono, color: a.up ? M : "#ef4444" }}>{a.pnl}</div>
                <Badge status={a.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert */}
      <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: `${A}09`, border: `1px solid ${A}20` }}>
        <div className="p-2 rounded-xl" style={{ background: `${A}14`, border: `1px solid ${A}25` }}><AlertTriangle size={14} style={{ color: A }} /></div>
        <div className="flex-1">
          <div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Policy Review Recommended</div>
          <div className="text-[11px] mt-0.5" style={{ ...sans, color: "#64748b" }}>SignalOracle policy expires in 28 minutes. Review before extending agent permissions.</div>
        </div>
        <ShimmerBtn label="Renew Now" accent={A} />
      </div>
    </div>
  );
}

/* ── 2. AGENTS ── */
function AgentsPage() {
  const [sel, setSel] = useState(0);
  const a = AGENTS_DATA[sel];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>My Agents</h1>
          <p className="text-sm mt-0.5" style={{ ...sans, color: "#475569" }}>Manage and monitor your deployed AI agents</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ ...sans, background: `${M}14`, border: `1px solid ${M}30`, color: M, boxShadow: `0 0 20px ${M}18` }}>
          <Plus size={13} />Deploy New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Agent list */}
        <div className="rounded-2xl overflow-hidden flex flex-col" style={{ ...glass() }}>
          {AGENTS_DATA.map((ag, i) => (
            <button key={`ag-list-${ag.id}`} onClick={() => setSel(i)}
              className="flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b"
              style={{ borderColor: "rgba(255,255,255,0.04)", background: sel === i ? `${ag.accent}0c` : "transparent", borderLeft: sel === i ? `2px solid ${ag.accent}` : "2px solid transparent" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ag.accent}14`, border: `1px solid ${ag.accent}22` }}>
                <Bot size={16} style={{ color: ag.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ ...sans, color: "#e2e8f0" }}>{ag.name}</div>
                <div className="text-[10px] mt-0.5" style={{ ...sans, color: "#475569" }}>{ag.tag}</div>
              </div>
              <Badge status={ag.status} />
            </button>
          ))}
        </div>

        {/* Agent detail */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
            <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${a.accent}60, transparent)` }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 0% 0%, ${a.accent}08, transparent 60%)` }} />
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${a.accent}16`, border: `1px solid ${a.accent}28`, boxShadow: `0 0 24px ${a.accent}20` }}>
                <Bot size={22} style={{ color: a.accent }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-bold" style={{ ...sans, color: "#e2e8f0" }}>{a.name}</h2>
                  <Badge status={a.status} />
                  <ShieldCheck size={14} style={{ color: M }} />
                </div>
                <div className="text-xs mt-1" style={{ ...mono, color: C }}>{a.hash}</div>
              </div>
              <div className="flex gap-2">
                <ShimmerBtn label={a.status === "ACTIVE" ? "Pause" : "Activate"} accent={a.status === "ACTIVE" ? A : M} />
                <button className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#475569" }}>
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total P&L", value: a.pnl, color: a.up ? M : "#ef4444" },
                { label: "Win Rate", value: `${a.winRate}%`, color: A },
                { label: "APY", value: a.apy, color: A },
                { label: "Uptime", value: `${a.uptime}%`, color: M },
              ].map((s, i) => (
                <div key={`det-stat-${i}`} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="text-[10px] mb-1" style={{ ...sans, color: "#475569" }}>{s.label}</div>
                  <div className="text-base font-bold" style={{ ...mono, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Perf chart */}
          <div className="rounded-2xl p-5" style={{ ...glass() }}>
            <div className="text-xs font-semibold mb-4" style={{ ...sans, color: "#94a3b8" }}>Performance — Last 7 Days</div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perfWeek}>
                  <defs>
                    <linearGradient id="ag-perf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={a.accent} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={a.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip color={a.accent} />} />
                  <Area type="monotone" dataKey="v" stroke={a.accent} strokeWidth={2} fill="url(#ag-perf)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agent policy info */}
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ ...glass(), border: `1px solid ${a.exp === "EXPIRED" ? "#ef444430" : M + "18"}` }}>
            <div className="p-2.5 rounded-xl" style={{ background: a.exp === "EXPIRED" ? "rgba(239,68,68,0.1)" : `${M}12`, border: `1px solid ${a.exp === "EXPIRED" ? "#ef444428" : M + "22"}` }}>
              <Key size={16} style={{ color: a.exp === "EXPIRED" ? "#ef4444" : M }} />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Solana Agent Policy</div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px]" style={{ ...mono, color: "#475569" }}>Expires in:</span>
                <span className="text-[11px] font-bold" style={{ ...mono, color: a.exp === "EXPIRED" ? "#ef4444" : M }}>{a.exp}</span>
              </div>
            </div>
            <ShimmerBtn label={a.exp === "EXPIRED" ? "Renew Key" : "Manage"} accent={a.exp === "EXPIRED" ? "#ef4444" : M} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 3. ANALYTICS ── */
function AnalyticsPage() {
  const [range, setRange] = useState("7D");
  const ranges = ["24H", "7D", "30D", "90D", "ALL"];

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ ...sans, color: "#475569" }}>Deep performance insights across all agents</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {ranges.map(r => (
            <button key={`range-${r}`} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ ...mono, background: range === r ? `${M}18` : "transparent", color: range === r ? M : "#475569", border: range === r ? `1px solid ${M}28` : "1px solid transparent" }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: "$48,291", delta: "+22.4%", color: A },
          { label: "Total Ops", value: "71,983", delta: "+8.1%", color: M },
          { label: "Avg Win Rate", value: "91.4%", delta: "+3.2%", color: M },
          { label: "Network Fees", value: "0.18 SOL", delta: "-11%", color: C },
        ].map((s, i) => (
          <div key={`an-kpi-${i}`} className="rounded-2xl p-5" style={{ ...glass(), boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            <div className="text-[11px] mb-2" style={{ ...sans, color: "#475569" }}>{s.label}</div>
            <div className="text-xl font-bold mb-1" style={{ ...mono, color: "#e2e8f0" }}>{s.value}</div>
            <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: s.delta.startsWith("+") ? M : "#ef4444" }}>
              {s.delta.startsWith("+") ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{s.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue line chart */}
      <div className="rounded-2xl p-5" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
        <SectionTitle icon={TrendingUp} text="Revenue Over Time" />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={perfWeek}>
              <defs>
                <linearGradient id="rev-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={C} />
                  <stop offset="100%" stopColor={M} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip color={M} prefix="$" />} />
              <Line type="monotone" dataKey="vol" stroke="url(#rev-line)" strokeWidth={2.5} dot={{ fill: M, r: 3, strokeWidth: 0 }} activeDot={{ fill: M, r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per-agent table */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Agent Breakdown</span>
          </div>
          {AGENTS_DATA.map((a, i) => (
            <div key={`an-ag-${a.id}`} className="grid items-center px-5 py-3 border-b hover:bg-white/[0.018] transition-colors"
              style={{ gridTemplateColumns: "1fr 80px 70px 70px", borderColor: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${a.accent}12`, border: `1px solid ${a.accent}20` }}><Bot size={11} style={{ color: a.accent }} /></div>
                <span className="text-xs font-medium" style={{ ...sans, color: "#e2e8f0" }}>{a.name}</span>
              </div>
              <span className="text-[11px] font-bold" style={{ ...mono, color: a.up ? M : "#ef4444" }}>{a.pnl}</span>
              <span className="text-[11px]" style={{ ...mono, color: A }}>{a.winRate}%</span>
              <span className="text-[11px]" style={{ ...mono, color: "#475569" }}>{a.ops.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Latency chart */}
        <div className="rounded-2xl p-5" style={{ ...glass() }}>
          <div className="text-sm font-semibold mb-1" style={{ ...sans, color: "#e2e8f0" }}>Execution Latency</div>
          <div className="text-[11px] mb-4" style={{ ...sans, color: "#475569" }}>Average ms · all agents · last 24h</div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData}>
                <defs>
                  <linearGradient id="an-lat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} unit="ms" />
                <Tooltip content={<ChartTip color={C} suffix="ms" />} />
                <Area type="monotone" dataKey="v" stroke={C} strokeWidth={1.5} fill="url(#an-lat)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fee heatmap style */}
      <div className="rounded-2xl p-5" style={{ ...glass() }}>
        <SectionTitle icon={BarChart2} text="Gas & Fees Distribution" accent={A} />
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perfWeek} barSize={28}>
              <defs>
                <linearGradient id="fee-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={A} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={A} stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<ChartTip color={A} prefix="$" />} />
              <Bar dataKey="fee" fill="url(#fee-bar)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ── 4. MARKETPLACE ── */
function MarketplacePage() {
  const [activeCat, setActiveCat] = useState(0);
  const [antiRug, setAntiRug] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = MARKETPLACE_AGENTS.filter(a => {
    if (antiRug && !a.verified) return false;
    if (activeCat > 0 && a.tag !== CATS[activeCat]) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}20` }}><Sparkles size={12} style={{ color: M }} /></div>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ ...mono, color: M }}>Decentralized AI Agent Marketplace</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Deploy <span style={{ color: M }}>Autonomous Agents</span></h1>
        <p className="text-sm mt-1 max-w-xl" style={{ ...sans, color: "#475569", lineHeight: 1.7 }}>Browse policy-aware AI agents designed for bounded execution and verifiable Solana guardrails.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#334155" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents by name, strategy, or tag..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-xs outline-none transition-all"
            style={{ ...sans, background: "rgba(11,17,16,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0", caretColor: M }}
            onFocus={e => { e.target.style.borderColor = `${M}35`; e.target.style.boxShadow = `0 0 0 3px ${M}10`; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} />
        </div>
        <button onClick={() => setAntiRug(r => !r)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={{ ...sans, background: antiRug ? `${M}12` : "rgba(11,17,16,0.6)", backdropFilter: "blur(20px)", border: `1px solid ${antiRug ? M + "35" : "rgba(255,255,255,0.06)"}`, color: antiRug ? M : "#475569", boxShadow: antiRug ? `0 0 20px ${M}18` : "none" }}>
          <ShieldCheck size={13} />Anti-Rug Verified
          <div className="relative w-8 h-4 rounded-full ml-1" style={{ background: antiRug ? `${M}35` : "rgba(255,255,255,0.08)", border: `1px solid ${antiRug ? M + "50" : "rgba(255,255,255,0.1)"}` }}>
            <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{ left: antiRug ? "calc(100% - 14px)" : 2, background: antiRug ? M : "#334155", boxShadow: antiRug ? `0 0 8px ${M}` : "none" }} />
          </div>
        </button>
        <button className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs shrink-0" style={{ ...sans, background: "rgba(11,17,16,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", color: "#475569" }}>
          <ArrowDownUp size={13} />Sort
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATS.map((cat, i) => (
          <button key={`mkt-cat-${i}`} onClick={() => setActiveCat(i)}
            className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={{ ...sans, background: activeCat === i ? `${M}14` : "rgba(11,17,16,0.6)", backdropFilter: "blur(16px)", border: `1px solid ${activeCat === i ? M + "40" : "rgba(255,255,255,0.06)"}`, color: activeCat === i ? M : "#475569", boxShadow: activeCat === i ? `0 0 18px ${M}18` : "none" }}>
            {cat}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ ...sans, color: "#334155" }}>Showing <span style={{ color: "#e2e8f0" }}>{filtered.length}</span> agents</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: M, animation: "redline-pulse 2s infinite" }} />
          <span className="text-[10px] font-bold" style={{ ...mono, color: M }}>CURATED PROTOTYPE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((a, idx) => (
            <div key={`mkt-card-${a.id}`}
              className="group relative rounded-2xl flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
              <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${a.accent}70, transparent)` }} />
              <div className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(ellipse at 30% 0%, ${a.accent}08, transparent 55%)` }} />
              {idx === 0 && activeCat === 0 && !search && (
                <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${A}18`, border: `1px solid ${A}28` }}>
                  <Sparkles size={9} style={{ color: A }} />
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ ...mono, color: A }}>Featured</span>
                </div>
              )}
              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${a.accent}18`, border: `1px solid ${a.accent}25`, boxShadow: `0 0 20px ${a.accent}14` }}>
                    <Bot size={18} style={{ color: a.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold" style={{ ...sans, color: "#e2e8f0" }}>{a.name}</span>{a.verified && <ShieldCheck size={12} style={{ color: M }} />}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ ...mono, color: a.accent, opacity: 0.7 }}>{a.version}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ ...sans, background: `${a.accent}10`, color: a.accent, border: `1px solid ${a.accent}18` }}>{a.tag}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ ...sans, color: "#64748b", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.desc}</p>
                <div className="rounded-xl px-3.5 py-3 space-y-1.5" style={{ background: "#010303", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-widest" style={{ ...sans, color: "#1e293b" }}>Policy</span><span className="text-[9px] uppercase tracking-widest" style={{ ...sans, color: "#1e293b" }}>Creator</span></div>
                  <div className="flex items-center justify-between"><span className="text-[10px]" style={{ ...mono, color: C }}>{a.hash}</span><span className="text-[10px]" style={{ ...mono, color: "#475569" }}>{a.deployer}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="space-y-1.5"><div className="flex justify-between"><span className="text-[10px]" style={{ ...sans, color: "#475569" }}>Win Rate</span><span className="text-[11px] font-bold" style={{ ...mono, color: A }}>{a.winRate}%</span></div><StatBar value={a.winRate} color={A} /></div>
                  <div className="space-y-1.5"><div className="flex justify-between"><span className="text-[10px]" style={{ ...sans, color: "#475569" }}>Uptime</span><span className="text-[11px] font-bold" style={{ ...mono, color: M }}>{a.uptime}%</span></div><StatBar value={a.uptime} color={M} /></div>
                  <div><div className="text-[10px] mb-0.5" style={{ ...sans, color: "#475569" }}>APY</div><div className="text-sm font-bold" style={{ ...mono, color: a.apy > 0 ? A : "#475569" }}>{a.apy > 0 ? `${a.apy}%` : "—"}</div></div>
                  <div><div className="text-[10px] mb-0.5" style={{ ...sans, color: "#475569" }}>Latency</div><div className="text-sm font-bold" style={{ ...mono, color: a.latency < 100 ? M : a.latency < 200 ? C : "#64748b" }}>{a.latency}ms</div></div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-1.5"><Activity size={10} style={{ color: "#475569" }} /><span className="text-[10px]" style={{ ...mono, color: "#475569" }}>{a.executions} ops</span></div>
                  <div className="flex items-center gap-1"><Star size={10} style={{ color: A, fill: A }} /><span className="text-[10px] font-semibold" style={{ ...mono, color: A }}>{a.stars}</span><span className="text-[10px]" style={{ ...sans, color: "#334155" }}>({a.reviews})</span></div>
                </div>
                <div className="flex flex-wrap gap-1.5">{a.tags.map((t, ti) => (<span key={`mkt-tag-${a.id}-${ti}`} className="text-[9px] px-2 py-0.5 rounded-md font-semibold" style={{ ...mono, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#475569" }}>{t}</span>))}</div>
              </div>
              <div className="px-6 py-4 border-t flex flex-col gap-3" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.25)" }}>
                <div className="flex items-center justify-between"><div><div className="text-[10px]" style={{ ...sans, color: "#334155" }}>Buy</div><div className="text-base font-bold" style={{ ...mono, color: "#e2e8f0" }}>{a.price}</div></div><div className="text-right"><div className="text-[10px]" style={{ ...sans, color: "#334155" }}>Rent</div><div className="text-[11px] font-semibold" style={{ ...mono, color: a.accent }}>{a.rent}</div></div></div>
                <div className="flex gap-2"><ShimmerBtn label="Rent" accent={C} full /><ShimmerBtn label="Buy" accent={a.accent} full /></div>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}

/* ── 5. VAULT ── */
function VaultPage() {
  const assets = [
    { symbol: "SOL", name: "Solana", bal: "84.21", usd: "$18,540", change: "+2.4%", up: true, color: "#9945ff" },
    { symbol: "USDC", name: "USD Coin", bal: "12,847.20", usd: "$12,847", change: "+0.01%", up: true, color: "#2775ca" },
    { symbol: "JUP", name: "Jupiter", bal: "4,184", usd: "$11,230", change: "+3.1%", up: true, color: "#14f195" },
    { symbol: "JTO", name: "Jito", bal: "2,200", usd: "$3,192", change: "-1.2%", up: false, color: "#8b5cf6" },
    { symbol: "PYTH", name: "Pyth Network", bal: "6,100", usd: "$2,100", change: "+0.00%", up: true, color: A },
  ];
  const txns = [
    { type: "Swap", desc: "SOL → USDC proposal via QuantPilot", amount: "+$2,847", hash: "5mQe…9a41", ts: "2 min ago", col: M },
    { type: "Deposit", desc: "Treasury funding for YieldGuard", amount: "+$847.20", hash: "3Kcp…c810", ts: "18 min ago", col: C },
    { type: "Fee", desc: "Devnet policy proof fee", amount: "-0.000005 SOL", hash: "8Trf…e200", ts: "34 min ago", col: "#475569" },
    { type: "Proof", desc: "Policy digest anchored on Devnet", amount: "verified", hash: "7eNb…3dc9", ts: "1h ago", col: M },
    { type: "Withdraw", desc: "USDC withdrawal after human approval", amount: "-$5,000", hash: "2bRa…f140", ts: "3h ago", col: "#ef4444" },
  ];

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Vault</h1>
          <p className="text-sm mt-0.5" style={{ ...sans, color: "#475569" }}>Solana treasury · policy-bounded agent permissions</p>
        </div>
        <div className="flex gap-2">
          <ShimmerBtn label="Deposit" accent={M} />
          <ShimmerBtn label="Withdraw" accent={A} />
        </div>
      </div>

      {/* Total balance card */}
      <div className="rounded-2xl p-7 relative overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div className="absolute top-0 left-12 right-12 h-px" style={{ background: `linear-gradient(90deg, transparent, ${M}60, transparent)` }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 0% 50%, ${M}07, transparent 55%)` }} />
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ ...mono, color: "#475569" }}>Total Portfolio Value</div>
            <div className="text-4xl font-bold" style={{ ...mono, color: "#e2e8f0", textShadow: `0 0 40px ${M}25` }}>$47,909.00</div>
            <div className="flex items-center gap-2 mt-2">
              <ArrowUpRight size={14} style={{ color: M }} />
              <span className="text-sm font-semibold" style={{ ...mono, color: M }}>+$2,847.20 today (+6.3%)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs mb-1" style={{ ...sans, color: "#475569" }}>Smart Account</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ ...mono, color: C }}>7Aqv…fK3p</span>
              <button className="p-1 rounded-md" style={{ background: "rgba(255,255,255,0.04)", color: "#475569" }}><Copy size={11} /></button>
              <button className="p-1 rounded-md" style={{ background: "rgba(255,255,255,0.04)", color: "#475569" }}><ExternalLink size={11} /></button>
            </div>
            <div className="text-[10px] mt-1" style={{ ...sans, color: "#334155" }}>Policy PDA · Solana Devnet</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {[["Agent P&L", "+$6,272", M], ["Staked", "$14,200", C], ["Claimable", "$821.40", A]].map(([k, v, col], i) => (
            <div key={`vault-sum-${i}`}>
              <div className="text-[10px] mb-1" style={{ ...sans, color: "#475569" }}>{k}</div>
              <div className="text-lg font-bold" style={{ ...mono, color: col as string }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Asset table */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Assets</span>
            <span className="text-[10px]" style={{ ...sans, color: "#475569" }}>5 tokens</span>
          </div>
          {assets.map((a, i) => (
            <div key={`asset-${i}`} className="flex items-center gap-4 px-5 py-3.5 border-b hover:bg-white/[0.02] transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.03)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: `${a.color}18`, border: `1px solid ${a.color}25`, color: a.color }}>{a.symbol[0]}</div>
              <div className="flex-1">
                <div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>{a.symbol}</div>
                <div className="text-[10px]" style={{ ...sans, color: "#475569" }}>{a.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold" style={{ ...mono, color: "#e2e8f0" }}>{a.bal}</div>
                <div className="text-[11px]" style={{ ...mono, color: "#475569" }}>{a.usd}</div>
              </div>
              <div className="text-[11px] font-semibold min-w-[52px] text-right" style={{ color: a.up ? M : "#ef4444" }}>{a.change}</div>
            </div>
          ))}
        </div>

        {/* Recent txns */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Recent Transactions</span>
          </div>
          {txns.map((tx, i) => (
            <div key={`tx-${i}`} className="px-5 py-3.5 border-b hover:bg-white/[0.018] transition-colors" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ ...mono, background: `${tx.col}12`, color: tx.col, border: `1px solid ${tx.col}22` }}>{tx.type}</span>
                <span className="text-xs font-bold" style={{ ...mono, color: tx.col }}>{tx.amount}</span>
              </div>
              <div className="text-[11px] mb-1" style={{ ...sans, color: "#94a3b8" }}>{tx.desc}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ ...mono, color: "#334155" }}>{tx.hash}</span>
                <span className="text-[10px]" style={{ ...sans, color: "#334155" }}>{tx.ts}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 6. SECURITY ── */
function SecurityPage() {
  const [twoFA, setTwoFA] = useState(true);
  const [alertsOn, setAlertsOn] = useState(true);
  const [autoRenew, setAutoRenew] = useState(false);

  const audits = [
    { name: "QuantTrader-Pro", status: "PASSED", score: 98, date: "2024-11-20", accent: M },
    { name: "ArbitrageBot-v3", status: "PASSED", score: 95, date: "2024-11-18", accent: M },
    { name: "NLPOracle-gpt4", status: "PENDING", score: null, date: "—", accent: A },
    { name: "YieldOptimizer-X", status: "PASSED", score: 91, date: "2024-11-10", accent: M },
    { name: "SentinelWatch-v1", status: "PASSED", score: 99, date: "2024-11-22", accent: M },
  ];

  const events = [
    { icon: ShieldCheck, text: "Anti-Rug scan passed · QuantTrader-Pro", ts: "2m ago", col: M },
    { icon: AlertTriangle, text: "Policy near expiry · SignalOracle", ts: "28m ago", col: A },
    { icon: Lock, text: "2FA verified · login from 192.168.1.42", ts: "1h ago", col: C },
    { icon: ShieldCheck, text: "Token allowlist updated · 3 mints added", ts: "3h ago", col: M },
    { icon: AlertTriangle, text: "Unusual tx volume detected · flagged", ts: "5h ago", col: "#ef4444" },
  ];

  function Toggle({ on, toggle, label }: { on: boolean; toggle: () => void; label: string }) {
    return (
      <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="text-xs font-medium" style={{ ...sans, color: "#94a3b8" }}>{label}</span>
        <button onClick={toggle} className="relative w-10 h-5 rounded-full transition-all duration-200"
          style={{ background: on ? `${M}35` : "rgba(255,255,255,0.07)", border: `1px solid ${on ? M + "50" : "rgba(255,255,255,0.1)"}` }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
            style={{ left: on ? "calc(100% - 18px)" : 2, background: on ? M : "#475569", boxShadow: on ? `0 0 10px ${M}` : "none" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Security Center</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: "#475569" }}>Anti-Rug protocol, audit results, and access controls</p>
      </div>

      {/* Security score */}
      <div className="rounded-2xl p-6 flex items-center gap-6 relative overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
        <div className="absolute top-0 left-12 right-12 h-px" style={{ background: `linear-gradient(90deg, transparent, ${M}50, transparent)` }} />
        <div className="relative shrink-0">
          <RadialBarChart width={120} height={120} innerRadius={40} outerRadius={56} data={[{ value: 94 }]} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={6} fill={M} background={{ fill: "rgba(255,255,255,0.04)" }} />
          </RadialBarChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ ...mono, color: M, textShadow: `0 0 20px ${M}50` }}>94</span>
            <span className="text-[9px]" style={{ ...mono, color: "#475569" }}>/ 100</span>
          </div>
        </div>
        <div>
          <div className="text-lg font-bold mb-1" style={{ ...sans, color: "#e2e8f0" }}>Security Score: <span style={{ color: M }}>Excellent</span></div>
          <p className="text-xs" style={{ ...sans, color: "#475569", lineHeight: 1.7 }}>All active agents passed policy checks. One authorization is nearing expiry; require a fresh review before extension.</p>
          <div className="flex gap-2 mt-3">
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ ...sans, background: `${M}12`, color: M, border: `1px solid ${M}22` }}>
              <CheckCircle2 size={10} />5 agents verified
            </span>
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ ...sans, background: `${A}12`, color: A, border: `1px solid ${A}22` }}>
              <AlertTriangle size={10} />1 key expiring
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Audit results */}
        <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Audit Results</span>
          </div>
          {audits.map((a, i) => (
            <div key={`audit-${i}`} className="flex items-center gap-3 px-5 py-3.5 border-b hover:bg-white/[0.018] transition-colors" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.accent}12`, border: `1px solid ${a.accent}20` }}><Bot size={13} style={{ color: a.accent }} /></div>
              <div className="flex-1"><div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>{a.name}</div><div className="text-[10px]" style={{ ...sans, color: "#475569" }}>{a.date}</div></div>
              {a.score !== null ? (
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ ...mono, color: M }}>{a.score}/100</div>
                  <span className="text-[10px] font-bold" style={{ ...mono, color: M }}>PASSED</span>
                </div>
              ) : (
                <span className="text-[10px] font-bold" style={{ ...mono, color: A }}>PENDING</span>
              )}
            </div>
          ))}
        </div>

        {/* Settings + events */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-3" style={{ ...sans, color: "#e2e8f0" }}>Security Settings</div>
            <Toggle on={twoFA} toggle={() => setTwoFA(v => !v)} label="Two-Factor Authentication" />
            <Toggle on={alertsOn} toggle={() => setAlertsOn(v => !v)} label="On-Chain Anomaly Alerts" />
            <Toggle on={autoRenew} toggle={() => setAutoRenew(v => !v)} label="Auto-Renew Low-Risk Policies" />
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}><span className="text-xs font-semibold" style={{ ...sans, color: "#94a3b8" }}>Security Events</span></div>
            {events.map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={`sec-ev-${i}`} className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                  <Icon size={13} style={{ color: e.col, flexShrink: 0 }} />
                  <span className="text-[11px] flex-1" style={{ ...sans, color: "#94a3b8" }}>{e.text}</span>
                  <span className="text-[10px] shrink-0" style={{ ...sans, color: "#334155" }}>{e.ts}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const tList = ["SOL", "USDC", "JUP", "JTO", "BONK", "PYTH"];
  const STEPS = ["Token Scope", "Spend Limits", "Time Bounds", "Review & Sign"];

  const policy: AgentPolicyInput = {
    agentName: "YieldGuard Alpha",
    strategy: "Risk-bounded DeFi yield optimization with human review for high-impact actions",
    tokens,
    spendCapUsdc: cap,
    maxTransactions: txn,
    durationHours: dur,
    cooldownMinutes: cool,
  };

  useEffect(() => {
    setAssessment(null);
    setAssessmentError("");
  }, [tokens, cap, txn, dur, cool]);

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

  const sessions = [
    { agent: "QuantPilot", key: "7Aqv…fK3p", cap: "$500", exp: "01:42:18", status: "ACTIVE", ops: 847, accent: M },
    { agent: "RouteScout", key: "9Nm2…Qx7d", cap: "$1,000", exp: "04:11:03", status: "ACTIVE", ops: 312, accent: C },
    { agent: "SignalOracle", key: "4Ytp…mR8a", cap: "$200", exp: "00:28:44", status: "EXPIRING", ops: 91, accent: A },
    { agent: "YieldGuard", key: "2Kzw…vH6n", cap: "$2,000", exp: "EXPIRED", status: "EXPIRED", ops: 0, accent: "#ef4444" },
  ];

  function SliderCtl({ label, value, onChange, min, max, unit, accent }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string; accent: string }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div className="space-y-2.5">
        <div className="flex justify-between">
          <span className="text-xs" style={{ ...sans, color: "#94a3b8" }}>{label}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ ...mono, color: accent, background: `${accent}12`, border: `1px solid ${accent}20` }}>{value.toLocaleString()}{unit}</span>
        </div>
        <div className="relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}60, ${accent})` }} />
          <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all"
            style={{ left: `calc(${pct}% - 7px)`, background: BG, borderColor: accent, boxShadow: `0 0 12px ${accent}70` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Agent Guardrails</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: "#475569" }}>Design bounded Solana policies, run AI risk checks, and publish verifiable proofs</p>
      </div>

      {/* Active sessions table */}
      <div className="rounded-2xl overflow-hidden" style={{ ...glass() }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Active Policy Accounts</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: `${M}14`, color: M, border: `1px solid ${M}25` }}>3 active</span>
        </div>
        {sessions.map((s, i) => (
          <div key={`sess-${i}`} className="flex items-center gap-4 px-5 py-3.5 border-b hover:bg-white/[0.018] transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.03)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.accent}12`, border: `1px solid ${s.accent}20` }}><Key size={13} style={{ color: s.accent }} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>{s.agent}</div>
              <div className="text-[10px]" style={{ ...mono, color: C }}>{s.key}</div>
            </div>
            <div className="hidden sm:block text-[11px] font-semibold" style={{ ...mono, color: A }}>{s.cap}</div>
            <div className="text-[11px] font-semibold" style={{ ...mono, color: s.status === "EXPIRED" ? "#ef4444" : s.status === "EXPIRING" ? A : M }}>{s.exp}</div>
            <Badge status={s.status === "EXPIRING" ? "PAUSED" : s.status === "EXPIRED" ? "IDLE" : "ACTIVE"} />
            <ShimmerBtn label={s.status === "EXPIRED" ? "Renew" : "Manage"} accent={s.accent} size="xs" />
          </div>
        ))}
      </div>

      {/* New session wizard */}
      <div className="rounded-2xl overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", background: `${M}04` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}25` }}><Key size={12} style={{ color: M }} /></div>
            <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Create Agent Policy</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ ...mono, background: `${C}14`, color: C, border: `1px solid ${C}25` }}>SOLANA DEVNET</span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <button key={`wiz-step-${i}`} onClick={() => setStep(i)} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full h-0.5 rounded-full transition-all" style={{ background: i <= step ? (i === step ? M : `${M}50`) : "rgba(255,255,255,0.07)" }} />
                <span className="text-[9px] font-semibold hidden sm:block" style={{ ...mono, color: i === step ? M : i < step ? `${M}60` : "rgba(148,163,184,0.35)" }}>
                  {String(i + 1).padStart(2, "0")} {s}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-6" style={{ minHeight: 240 }}>
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ ...sans, color: "#94a3b8", lineHeight: 1.7 }}>Allowlist the SPL assets this agent may reference. Every other mint remains outside the signed policy.</p>
              <div className="flex flex-wrap gap-2">
                {tList.map((t, ti) => { const on = tokens.includes(t); return (
                  <button key={`wiz-tok-${ti}`} onClick={() => setTokens(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                    style={{ ...mono, background: on ? `${M}15` : "rgba(255,255,255,0.03)", border: `1px solid ${on ? M + "40" : "rgba(255,255,255,0.07)"}`, color: on ? M : "#64748b", boxShadow: on ? `0 0 14px ${M}20` : "none" }}>
                    {t}
                  </button>
                ); })}
              </div>
              <div className="rounded-xl p-3 flex gap-2.5" style={{ background: `${C}0a`, border: `1px solid ${C}18` }}>
                <Lock size={12} style={{ color: C, marginTop: 1, flexShrink: 0 }} />
                <p className="text-[11px]" style={{ ...sans, color: "#94a3b8", lineHeight: 1.6 }}>The policy digest binds token scope, spend cap, execution limit, cooldown, and validity window into one verifiable proof.</p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-xs" style={{ ...sans, color: "#94a3b8" }}>Configure total spend ceiling and per-session transaction limits.</p>
              <SliderCtl label="Total Spend Cap" value={cap} onChange={setCap} min={10} max={10000} unit=" USDC" accent={A} />
              <SliderCtl label="Max Transactions / Session" value={txn} onChange={setTxn} min={1} max={500} unit=" txns" accent={C} />
              <div className="grid grid-cols-3 gap-2">
                {[{ label: "Avg/Tx", value: `$${(cap / txn).toFixed(2)}`, color: A }, { label: "Risk", value: cap > 5000 ? "HIGH" : cap > 1000 ? "MED" : "LOW", color: cap > 5000 ? "#ef4444" : cap > 1000 ? A : M }, { label: "Tokens", value: String(tokens.length), color: C }].map((row, ri) => (
                  <div key={`wiz-row-${ri}`} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="text-[10px] mb-1" style={{ ...sans, color: "#64748b" }}>{row.label}</div>
                    <div className="text-sm font-bold" style={{ ...mono, color: row.color }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-xs" style={{ ...sans, color: "#94a3b8" }}>Set validity window and minimum cooldown between executions.</p>
              <SliderCtl label="Session Duration" value={dur} onChange={setDur} min={1} max={168} unit="h" accent={M} />
              <SliderCtl label="Execution Cooldown" value={cool} onChange={setCool} min={1} max={60} unit="m" accent={C} />
              <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: `${M}09`, border: `1px solid ${M}18` }}>
                <Timer size={14} style={{ color: M, flexShrink: 0 }} />
                <div>
                  <div className="text-[11px] font-semibold" style={{ ...mono, color: M }}>Expires {new Date(Date.now() + dur * 3600000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="text-[10px] mt-0.5" style={{ ...sans, color: "#64748b" }}>≤ {Math.floor((dur * 60) / cool)} executions · {cool}m cooldown</div>
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ ...sans, color: "#94a3b8" }}>Review the bounded policy, run the risk copilot, then publish its SHA-256 digest to Solana Devnet.</p>
              <div>
              {[["Token Scope", tokens.join(", "), C], ["Spend Cap", `${cap.toLocaleString()} USDC`, A], ["Max Txns", `${txn} transactions`, C], ["Duration", `${dur} hours`, M], ["Cooldown", `${cool} minutes`, M], ["Network", "Solana Devnet", C]].map(([k, v, col], ri) => (
                <div key={`rev-${ri}`} className="flex justify-between py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <span className="text-[11px]" style={{ ...sans, color: "#64748b" }}>{k}</span>
                  <span className="text-[11px] font-semibold" style={{ ...mono, color: col as string }}>{v}</span>
                </div>
              ))}
              </div>
              {assessment && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: `${assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : "#ef4444"}0b`, border: `1px solid ${assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : "#ef4444"}25` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: "#e2e8f0" }}>Risk copilot verdict</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>{assessment.source === "openai" ? `OpenAI · ${assessment.model}` : "Deterministic safety fallback"}</div>
                    </div>
                    <div className="text-right"><div className="text-xl font-bold" style={{ ...mono, color: assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : "#ef4444" }}>{assessment.score}/100</div><div className="text-[10px]" style={{ ...mono, color: "#94a3b8" }}>{assessment.decision}</div></div>
                  </div>
                  <p className="text-[11px]" style={{ color: "#94a3b8" }}>{assessment.summary}</p>
                  <ul className="space-y-1">{assessment.findings.slice(0, 3).map((finding, index) => <li key={`finding-${index}`} className="text-[10px] flex gap-2" style={{ color: "#64748b" }}><span style={{ color: C }}>•</span>{finding}</li>)}</ul>
                  <PolicyProofButton policy={policy} assessment={assessment} />
                </div>
              )}
              {assessmentError && <p role="alert" className="text-[10px]" style={{ color: "#f87171" }}>{assessmentError}</p>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-25"
            style={{ ...sans, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" }}>Back</button>
          <button onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : void assessPolicy()} disabled={assessing}
            className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ ...sans, background: step === STEPS.length - 1 ? `linear-gradient(135deg, ${M}dd, ${C}cc)` : `${M}18`, border: `1px solid ${M}35`, color: step === STEPS.length - 1 ? BG : M, boxShadow: step === STEPS.length - 1 ? `0 0 32px ${M}30` : "none" }}>
            {step === STEPS.length - 1 ? <><Shield size={12} />{assessing ? "Assessing policy…" : assessment ? "Re-run risk assessment" : "Run AI risk assessment"}</> : <>Continue <ChevronRight size={12} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 8. SETTINGS ── */
function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [gasAlerts, setGasAlerts] = useState(true);
  const [autoSlippage, setAutoSlippage] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [activeTab, setActiveTab] = useState(0);
  const [notificationStates, setNotificationStates] = useState([true, true, false, true, true]);
  const tabs = ["General", "Network", "Notifications", "API Keys"];

  function Row({ label, value, accent = M }: { label: string; value: string; accent?: string }) {
    return (
      <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="text-xs" style={{ ...sans, color: "#94a3b8" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ ...mono, color: accent }}>{value}</span>
      </div>
    );
  }

  function ToggleRow({ on, toggle, label, sub }: { on: boolean; toggle: () => void; label: string; sub?: string }) {
    return (
      <div className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div>
          <div className="text-xs font-medium" style={{ ...sans, color: "#e2e8f0" }}>{label}</div>
          {sub && <div className="text-[10px] mt-0.5" style={{ ...sans, color: "#475569" }}>{sub}</div>}
        </div>
        <button onClick={toggle} className="relative w-10 h-5 rounded-full transition-all duration-200 shrink-0 ml-4"
          style={{ background: on ? `${M}35` : "rgba(255,255,255,0.07)", border: `1px solid ${on ? M + "50" : "rgba(255,255,255,0.1)"}` }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ left: on ? "calc(100% - 18px)" : 2, background: on ? M : "#475569", boxShadow: on ? `0 0 10px ${M}` : "none" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: "#475569" }}>Configure your REDLINE workspace</p>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl p-6 flex items-center gap-5 relative overflow-hidden" style={{ ...glass() }}>
        <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${M}40, transparent)` }} />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
          style={{ background: `linear-gradient(135deg, ${M}22, ${C}18)`, border: `1px solid ${M}28`, boxShadow: `0 0 24px ${M}18`, color: M }}>
          KP
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ ...sans, color: "#e2e8f0" }}>Devnet Operator</div>
          <div className="text-[11px] mt-0.5" style={{ ...mono, color: C }}>Connect a Wallet Standard account to load the live address</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...sans, background: `${M}12`, color: M, border: `1px solid ${M}22` }}>Devnet</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...sans, background: `${C}12`, color: C, border: `1px solid ${C}22` }}>Wallet Standard</span>
          </div>
        </div>
        <ShimmerBtn label="Edit Profile" accent={M} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {tabs.map((t, i) => (
          <button key={`set-tab-${i}`} onClick={() => setActiveTab(i)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ ...sans, background: activeTab === i ? `${M}18` : "transparent", color: activeTab === i ? M : "#475569", border: activeTab === i ? `1px solid ${M}28` : "1px solid transparent" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {activeTab === 0 && (<>
          <div className="rounded-2xl p-5" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-4" style={{ ...sans, color: "#e2e8f0" }}>Appearance</div>
            <ToggleRow on={darkMode} toggle={() => setDarkMode(v => !v)} label="Dark Mode" sub="Obsidian theme (recommended)" />
            <ToggleRow on={notifications} toggle={() => setNotifications(v => !v)} label="In-app notifications" sub="Real-time agent status updates" />
            <div className="py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="text-xs font-medium mb-2" style={{ ...sans, color: "#e2e8f0" }}>Accent Color</div>
              <div className="flex gap-2">{[M, C, A, "#8b5cf6", "#ef4444"].map((col, ci) => (<button key={`acc-col-${ci}`} className="w-7 h-7 rounded-full border-2 transition-all" style={{ background: col, borderColor: col === M ? "#e2e8f0" : "transparent" }} />))}</div>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-4" style={{ ...sans, color: "#e2e8f0" }}>Trading Preferences</div>
            <ToggleRow on={autoSlippage} toggle={() => setAutoSlippage(v => !v)} label="Auto Slippage" sub="Dynamically set slippage tolerance" />
            {!autoSlippage && (
              <div className="py-3">
                <div className="flex justify-between mb-2"><span className="text-xs" style={{ ...sans, color: "#94a3b8" }}>Slippage Tolerance</span><span className="text-xs font-bold" style={{ ...mono, color: M }}>{slippage}%</span></div>
                <div className="relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${(slippage / 5) * 100}%`, background: `linear-gradient(90deg, ${M}60, ${M})` }} />
                  <input type="range" min={0.1} max={5} step={0.1} value={slippage} onChange={e => setSlippage(+e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2" style={{ left: `calc(${(slippage / 5) * 100}% - 7px)`, background: BG, borderColor: M, boxShadow: `0 0 10px ${M}70` }} />
                </div>
              </div>
            )}
          </div>
        </>)}
        {activeTab === 1 && (<>
          <div className="rounded-2xl p-5" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-4" style={{ ...sans, color: "#e2e8f0" }}>RPC Configuration</div>
            <Row label="Network" value="Solana Devnet" />
            <Row label="RPC Endpoint" value="api.devnet.solana.com" accent={C} />
            <Row label="Wallet API" value="Wallet Standard" accent={C} />
            <Row label="Commitment" value="confirmed" accent={M} />
            <Row label="Policy Proof" value="SPL Memo" accent={A} />
            <div className="mt-4"><ShimmerBtn label="Change RPC" accent={C} /></div>
          </div>
          <div className="rounded-2xl p-5" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-4" style={{ ...sans, color: "#e2e8f0" }}>Transaction Safety</div>
            <Row label="Preflight" value="enabled" accent={C} />
            <Row label="Policy Digest" value="SHA-256" accent={M} />
            <Row label="Proof Program" value="SPL Memo" accent={C} />
            <ToggleRow on={gasAlerts} toggle={() => setGasAlerts(v => !v)} label="Priority Fee Alerts" sub="Warn before unusually high priority fees" />
          </div>
        </>)}
        {activeTab === 2 && (
          <div className="rounded-2xl p-5 col-span-2" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-4" style={{ ...sans, color: "#e2e8f0" }}>Notification Channels</div>
            {[
              { label: "Agent status changes", sub: "Active, paused, expired events", on: true },
              { label: "Policy expiry warnings", sub: "Alert 1h and 10min before expiry", on: true },
              { label: "P&L threshold alerts", sub: "Trigger on ±10% daily swing", on: false },
              { label: "Priority fee spikes", sub: "Notify before unusually expensive transactions", on: true },
              { label: "Security anomalies", sub: "Unusual on-chain behavior detected", on: true },
            ].map((n, ni) => (
              <ToggleRow key={`notif-${ni}`} on={notificationStates[ni] ?? n.on} toggle={() => setNotificationStates(values => values.map((value, index) => index === ni ? !value : value))} label={n.label} sub={n.sub} />
            ))}
          </div>
        )}
        {activeTab === 3 && (
          <div className="rounded-2xl p-5 col-span-2" style={{ ...glass() }}>
            <div className="text-sm font-semibold mb-4" style={{ ...sans, color: "#e2e8f0" }}>API Keys</div>
            {[
              { label: "REDLINE API", value: "Server-side only", active: true },
              { label: "Solana RPC", value: "Configured via environment", active: true },
              { label: "OpenAI Risk Copilot", value: "Optional server-side key", active: false },
            ].map((k, ki) => (
              <div key={`api-key-${ki}`} className="flex items-center gap-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.active ? `${M}12` : "rgba(255,255,255,0.04)", border: `1px solid ${k.active ? M + "22" : "rgba(255,255,255,0.07)"}` }}>
                  <Key size={13} style={{ color: k.active ? M : "#475569" }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium" style={{ ...sans, color: "#e2e8f0" }}>{k.label}</div>
                  <div className="text-[10px]" style={{ ...mono, color: k.active ? C : "#334155" }}>{k.value}</div>
                </div>
                <ShimmerBtn label={k.active ? "Rotate" : "Add Key"} accent={k.active ? A : M} size="xs" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
        <div className="text-sm font-semibold mb-1" style={{ ...sans, color: "#ef4444" }}>Danger Zone</div>
        <p className="text-xs mb-4" style={{ ...sans, color: "#64748b" }}>These actions are irreversible. Proceed with caution.</p>
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 rounded-xl text-xs font-semibold transition-all" style={{ ...sans, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>Revoke All Agent Policies</button>
          <button className="px-4 py-2 rounded-xl text-xs font-semibold transition-all" style={{ ...sans, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>Disconnect Wallet</button>
          <button className="px-4 py-2 rounded-xl text-xs font-semibold transition-all" style={{ ...sans, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>Delete All Agents</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ROOT LAYOUT
══════════════════════════════════════════════════════════════ */
const PAGES = [DashboardPage, AgentsPage, AnalyticsPage, MarketplacePage, VaultPage, SecurityPage, SessionsPage, SettingsPage];

export default function App() {
  const [nav, setNav] = useState(0);
  const [time, setTime] = useState(new Date());
  const Page = PAGES[nav];

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="min-h-screen w-full flex overflow-hidden" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes redline-shimmer { 0% { left: -60px; } 100% { left: calc(100% + 60px); } }
        @keyframes redline-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes redline-scan { 0% { top:-2%; } 100% { top:102%; } }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
        input[type=range] { -webkit-appearance: none; appearance: none; }
      `}</style>

      <ParticleGrid />

      {/* ── Sidebar ── */}
      <aside className="sticky top-0 h-screen flex flex-col z-20 w-16 lg:w-60 shrink-0"
        style={{ background: "rgba(4,8,7,0.94)", backdropFilter: "blur(32px)", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="px-4 py-5 flex items-center gap-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${M}22, ${C}18)`, border: `1px solid ${M}30`, boxShadow: `0 0 24px ${M}20, inset 0 0 20px ${M}06` }}>
            <Zap size={15} style={{ color: M }} />
          </div>
          <div className="hidden lg:block">
            <div className="text-sm font-bold tracking-widest" style={{ color: "#e2e8f0", letterSpacing: "0.1em" }}>REDLINE</div>
            <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ ...mono, color: M, opacity: 0.65 }}>Protocol · Devnet</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item, i) => {
            const Icon = item.icon;
            const on = nav === i;
            return (
              <button key={`nav-${i}`} onClick={() => setNav(i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative"
                style={{ background: on ? `${M}0d` : "transparent", border: `1px solid ${on ? M + "1e" : "transparent"}` }}>
                {on && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: M, boxShadow: `0 0 10px ${M}` }} />}
                <Icon size={15} style={{ color: on ? M : "#334155", flexShrink: 0 }} />
                <span className="hidden lg:block text-xs font-medium flex-1 text-left" style={{ ...sans, color: on ? "#e2e8f0" : "#334155" }}>{item.label}</span>
                {item.badge && <span className="hidden lg:flex items-center justify-center text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ ...mono, background: `${M}18`, color: M, border: `1px solid ${M}22` }}>{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mx-2 mb-3 rounded-xl p-3 hidden lg:block" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: M, animation: "redline-pulse 2s infinite" }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ ...mono, color: M }}>SOLANA DEVNET</span>
          </div>
          {[["Cluster", "Devnet", "#e2e8f0"], ["Policy", "Memo v1", A], ["Mode", "Guarded", C]].map(([k, v, col], ni) => (
            <div key={`sidebar-net-${ni}`} className="flex justify-between items-center mb-0.5">
              <span className="text-[9px]" style={{ ...sans, color: "#334155" }}>{k}</span>
              <span className="text-[9px] font-semibold" style={{ ...mono, color: col }}>{v}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3.5"
          style={{ background: "rgba(4,7,7,0.82)", backdropFilter: "blur(32px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2 text-xs flex-1">
            <span style={{ ...sans, color: "#334155" }}>REDLINE</span>
            <ChevronRight size={11} style={{ color: "#1e293b" }} />
            <span style={{ ...sans, color: "#e2e8f0" }}>{NAV[nav].label}</span>
          </div>
          <div className="hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl text-[11px]"
            style={{ ...mono, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ color: "#334155" }}>SOLANA</span>
            <span style={{ color: M }}>DEVNET</span>
            <span style={{ color: C }}>RPC CONFIGURED</span>
            <span style={{ color: A }}>PROTOTYPE DATA</span>
            <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.07)" }} />
            <Clock size={10} style={{ color: "#334155" }} />
            <span style={{ color: "#94a3b8" }}>{time.toLocaleTimeString("en-US", { hour12: false })}</span>
          </div>
          <button className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#475569" }}>
            <RefreshCw size={13} />
          </button>
          <SolanaWalletControl />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-5 lg:px-8 py-7">
          <Page />
          <div className="h-8" />
        </main>
      </div>
    </div>
  );
}
