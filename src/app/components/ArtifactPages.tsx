import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import {
Activity,
AlertTriangle,
Bot,
CheckCircle2,
Cpu,
Gauge,
Play,
Server,
ShieldCheck,
Sparkles,
Wallet,
} from "lucide-react";
import { useEffect,useMemo,useState,type CSSProperties } from "react";
import { useRealAgents } from "../lib/agents";
import { api,API_URL,checkHealth,short,type Analytics,type Health } from "../lib/api";
import type { AppClient } from "../solana/client";
import { color } from "../theme";
import { ProtocolConsole } from "./ProtocolConsole";

const panel: CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
};

const modelOptions = [
  { name: "Configured model", note: "Backend · grounded assistant", tone: color.info },
  { name: "Deterministic floor", note: "Rules · always available", tone: color.verified },
  { name: "Gate registry", note: "Seven on-chain checks", tone: color.warn },
];

export function CopilotPage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : undefined;
  const [health, setHealth] = useState<Health | null>(null);
  const [healthState, setHealthState] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let live = true;
    checkHealth().then(result => {
      if (live) { setHealth(result); setHealthState("online"); }
    }).catch(() => {
      if (live) { setHealth(null); setHealthState("offline"); }
    });
    return () => { live = false; };
  }, []);

  return (
    <div className="route-page page-copilot artifact-page-grid">
      <div className="route-local-heading" aria-hidden="true" />
      <aside className="artifact-side-panel copilot-model-rail" style={panel}>
        <div className="artifact-panel-kicker"><span />Assistant stack</div>
        {modelOptions.map((model, index) => (
          <div className="artifact-model-option" key={model.name}>
            <span className="artifact-icon" style={{ color: model.tone }}><Bot size={15} /></span>
            <span><strong>{model.name}</strong><small>{model.note}</small></span>
            <i style={{ background: model.tone }} />
          </div>
        ))}
        <div className="artifact-panel-kicker artifact-panel-kicker-spaced"><span />Grounding</div>
        <div className="artifact-grounding-list">
          <span>Ledger events</span><b>LIVE</b>
          <span>Gate registry</span><b>7</b>
          <span>Owner scope</span><b>{owner ? "WALLET" : "PROTOCOL"}</b>
        </div>
      </aside>

      <section className="copilot-console-stage">
        <div className="artifact-stage-head">
          <div><span>REDLINE COPILOT</span><strong>Ask the ledger. Verify the answer.</strong></div>
          <em><i /> GROUNDED</em>
        </div>
        <ProtocolConsole owner={owner} />
      </section>

      <aside className="artifact-side-panel copilot-status-panel" style={panel}>
        <div className="artifact-panel-kicker"><span />Running now</div>
        <h3>Operations assistant</h3>
        <p>Answers use recorded grants, audit events and the same seven gate definitions shown across REDLINE.</p>
        <div className="artifact-metric-grid">
          <div><small>API</small><strong>{healthState.toUpperCase()}</strong></div>
          <div><small>CHAIN</small><strong>{health?.chain ?? "—"}</strong></div>
          <div><small>GATES</small><strong>7</strong></div>
          <div><small>SCOPE</small><strong>{owner ? "OWNER" : "GLOBAL"}</strong></div>
        </div>
        <div className="artifact-connection-card">
          <Server size={14} />
          <span><small>OPENAI-COMPATIBLE BACKEND</small><code>{API_URL}</code></span>
        </div>
        <p className="artifact-trust-note"><ShieldCheck size={14} /> The assistant explains. Your wallet remains the only signer.</p>
      </aside>
    </div>
  );
}

type Benchmark = { latency: number; source: string; model: string } | null;

export function ModelsPage() {
  const [benchmark, setBenchmark] = useState<Benchmark>(null);
  const [busy, setBusy] = useState(false);
  const [measurements, setMeasurements] = useState<number[]>([]);
  const [error, setError] = useState("");

  async function runBenchmark() {
    setBusy(true);
    setError("");
    const started = performance.now();
    try {
      const reply = await api.ask("Explain which REDLINE gate protects the spending cap.");
      const latency = Math.round(performance.now() - started);
      setBenchmark({ latency, source: reply.source, model: reply.model });
      setMeasurements(values => [...values.slice(-11), latency]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connectivity check failed");
    } finally {
      setBusy(false);
    }
  }

  const checks = [
    "Grounds answers in recorded state",
    "Names the refusing gate and reason code",
    "Keeps signing authority in the wallet",
    "Falls back to deterministic rules",
    "Avoids inventing unknown figures",
  ];

  return (
    <div className="route-page page-models artifact-model-layout">
      <div className="route-local-heading" aria-hidden="true" />
      <aside className="model-identity-card" style={panel}>
        <div className="model-prism" aria-hidden="true"><span /><span /><span /></div>
        <small>MODEL UNDER TEST · BACKEND</small>
        <h2>{benchmark?.model || "Configured assistant"}</h2>
        <p>The active model is discovered through a real grounded request. Until then, REDLINE reports configuration without inventing hardware figures.</p>
        <div className="artifact-metric-grid">
          <div><small>SOURCE</small><strong>{benchmark?.source ?? "—"}</strong></div>
          <div><small>LATENCY</small><strong>{benchmark ? `${benchmark.latency} ms` : "—"}</strong></div>
          <div><small>GROUNDING</small><strong>LEDGER</strong></div>
          <div><small>AUTHORITY</small><strong>READ ONLY</strong></div>
        </div>
        <button type="button" className="artifact-primary-button" onClick={() => void runBenchmark()} disabled={busy}>
          <Play size={14} />{busy ? "Running check…" : "Run grounded benchmark"}
        </button>
        {error && <p className="artifact-error"><AlertTriangle size={13} />{error}</p>}
      </aside>

      <section className="model-observability-grid">
        {[
          { label: "Measured latency", value: benchmark ? `${benchmark.latency} ms` : "—", icon: Gauge, sub: "one live grounded request" },
          { label: "Answer source", value: benchmark?.source?.toUpperCase() ?? "—", icon: Cpu, sub: "reported by the API" },
          { label: "Policy gates", value: "7", icon: ShieldCheck, sub: "enforced on-chain" },
          { label: "Signing access", value: "0", icon: Wallet, sub: "model cannot sign" },
        ].map(item => (
          <article className="artifact-kpi-card" style={panel} key={item.label}>
            <item.icon size={14} /><small>{item.label}</small><strong>{item.value}</strong><span>{item.sub}</span>
          </article>
        ))}
        <article className="model-chart-card" style={panel}>
          <header><h3>Latency profile</h3><span>LIVE CHECK</span></header>
          <div className="model-bars" aria-label="Measured request latency in milliseconds">
            {measurements.length ? measurements.map((ms, index) => <i key={index} title={`Request ${index + 1}: ${ms} ms`} style={{ height: `${ms / Math.max(...measurements) * 90}%` }}><span>{ms} ms</span></i>) : <p>No measurements yet. Run a benchmark to start.</p>}
          </div>
          <p>Last 12 successful requests in this session. Values include network and server response time.</p>
        </article>
        <article className="model-check-card" style={panel}>
          <header><h3>Trust boundary checklist</h3><span>5 CONTROLS</span></header>
          {checks.map(check => <div key={check}><CheckCircle2 size={14} /><span>{check}</span><small>DESIGN</small></div>)}
        </article>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const wallet = connected ? String(connected.account.address) : "";
  const { agents } = useRealAgents();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!wallet) { setAnalytics(null); return; }
    let live = true;
    setAnalytics(null);
    api.analytics(wallet).then(value => { if (live) setAnalytics(value); }).catch(() => { if (live) setAnalytics(null); });
    return () => { live = false; };
  }, [wallet]);

  const activity = useMemo(() => {
    const points = analytics?.weeklyVolume ?? [];
    const max = Math.max(1, ...points.map(p => p.volumeUsdc));
    return points.map(p => ({ ...p, opacity: Math.max(0.08, p.volumeUsdc / max) }));
  }, [analytics]);

  return (
    <div className="route-page page-profile artifact-profile-layout">
      <div className="route-local-heading" aria-hidden="true" />
      <aside className="profile-identity-card" style={panel}>
        <div className="profile-avatar"><Wallet size={25} /></div>
        <small>OWNER IDENTITY · SOLANA</small>
        <h2>{wallet ? short(wallet, 6) : "Wallet not connected"}</h2>
        <p>{wallet || "Connect a wallet to load the owner-scoped profile."}</p>
        <div className="profile-rank"><Sparkles size={14} /><span>REDLINE OPERATOR</span></div>
        <dl>
          <div><dt>Registry versions</dt><dd>{agents.length}</dd></div>
          <div><dt>Active grants</dt><dd>{analytics?.activeGrants ?? "—"}</dd></div>
          <div><dt>Total grants</dt><dd>{analytics?.totalGrants ?? "—"}</dd></div>
          <div><dt>Confirmed volume</dt><dd>{analytics ? `${analytics.totalVolumeUsdc.toLocaleString()} USDC` : "—"}</dd></div>
        </dl>
      </aside>

      <section className="profile-data-stage">
        <div className="profile-kpis">
          {[
            ["Active grants", analytics?.activeGrants ?? "—"],
            ["Transactions", analytics?.totalTransactions ?? "—"],
            ["Success rate", analytics?.successRatePct == null ? "—" : `${analytics.successRatePct}%`],
            ["Blocked", analytics?.totalRejections ?? "—"],
          ].map(([label, value]) => <article style={panel} key={label}><small>{label}</small><strong>{value}</strong><Activity size={14} /></article>)}
        </div>
        <article className="profile-activity-card" style={panel}>
          <header><div><h3>Confirmed volume</h3><p>Built from the wallet's seven-day confirmed volume.</p></div><span>LIVE LEDGER</span></header>
          <div className="profile-heatmap">
            {activity.map((point, index) => <div key={index}><i style={{ opacity: point.opacity }} /><small>{point.t}</small><b>{point.volumeUsdc.toLocaleString()} USDC</b></div>)}
            {!activity.length && <p>Connect a wallet to load its recorded activity.</p>}
          </div>
          <footer><span>LOW</span><span>OWNER-SCOPED ACTIVITY</span><span>HIGH</span></footer>
        </article>
      </section>
    </div>
  );
}
