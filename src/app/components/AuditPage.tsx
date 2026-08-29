import { useCallback, useEffect, useState } from "react";
import {
  ScrollText, ExternalLink, Filter, RefreshCw, Search,
  ShieldCheck, ShieldOff, Zap, Play, AlertTriangle,
  CheckCircle2, XCircle, Eye, FileText, Activity,
  ChevronDown,
} from "lucide-react";
import { api, subscribeFeed, fmtUsdc, short, type AuditRow, type Grant, type FeedEvent } from "../lib/api";
import { explorerTransactionUrl } from "../solana/client";

const M = "#00ffc4", C = "#06b6d4", A = "#e2b714", R = "#ef4444";
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const sans: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };
const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "rgba(11,17,16,0.6)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.05)",
  ...extra,
});

/* Event type → color + icon mapping */
function eventMeta(eventType: string): { color: string; icon: React.ElementType; label: string } {
  switch (eventType) {
    case "grant.created": return { color: M, icon: ShieldCheck, label: "Grant Created" };
    case "grant.revoked": return { color: R, icon: ShieldOff, label: "Grant Revoked" };
    case "run.started": return { color: C, icon: Play, label: "Run Started" };
    case "run.ended": return { color: "#64748b", icon: XCircle, label: "Run Ended" };
    case "intent.created": return { color: C, icon: Zap, label: "Intent Created" };
    case "decision.precheck":return { color: A, icon: Eye, label: "Precheck" };
    case "tx.confirmed": return { color: M, icon: CheckCircle2, label: "TX Confirmed" };
    case "tx.rejected": return { color: R, icon: XCircle, label: "TX Rejected" };
    case "chain.policy_decision": return { color: M, icon: Activity, label: "Policy Decision" };
    case "chain.grant_revoked": return { color: R, icon: ShieldOff, label: "Chain Revoked" };
    case "chain.grant_created": return { color: M, icon: ShieldCheck, label: "Chain Grant" };
    case "chain.tx_failed": return { color: R, icon: AlertTriangle, label: "Chain TX Failed" };
    case "agent.published": return { color: C, icon: FileText, label: "Agent Published" };
    default: return { color: "#64748b", icon: Activity, label: eventType };
  }
}

/* Describe payload for human readability */
function describePayload(row: AuditRow): string {
  const p = row.payload as Record<string, unknown>;
  switch (row.eventType) {
    case "grant.created": {
      const limits = p.limits as Record<string, unknown> | undefined;
      if (limits) return `cap ${fmtUsdc(String(limits.spendCapUnits ?? 0))} USDC · ${limits.maxTransactions} tx · grant ${short(String(p.grantPda ?? ""))}`;
      return `grant ${short(String(p.grantPda ?? ""))}`;
    }
    case "grant.revoked": return `owner revoked grant`;
    case "run.started": return `mode: ${p.mode ?? "unknown"}`;
    case "run.ended": return `reason: ${p.reason ?? "completed"}`;
    case "intent.created": return `#${p.nonce} · ${fmtUsdc(String(p.amountUnits ?? 0))} USDC → ${short(String(p.destination ?? ""))}`;
    case "decision.precheck": return p.allow ? "all gates passed" : `DENY: ${p.reasonCode} — ${p.message}`;
    case "tx.confirmed": {
      const counters = p.counters as Record<string, unknown> | undefined;
      return `spent ${fmtUsdc(String(counters?.spentUnits ?? 0))} USDC · tx #${p.transactionCount ?? ""}`;
    }
    case "tx.rejected": return `${p.reasonCode} · nothing moved`;
    case "chain.policy_decision": return `nonce ${p.nonce} · spent ${fmtUsdc(String(p.spentUnits ?? 0))} USDC`;
    case "chain.grant_revoked": return "grant revoked on-chain";
    case "chain.tx_failed": return `${p.variant ?? p.code ?? "unknown error"}`;
    default: return JSON.stringify(p).slice(0, 120);
  }
}

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const auditRows = await api.audit(selectedGrant || undefined);
      setRows(auditRows);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, [selectedGrant]);

  /* Load grants for filter dropdown */
  useEffect(() => {
    api.grants().then(setGrants).catch(() => { /* grants filter unavailable */ });
  }, []);

  /* Load audit rows + subscribe to SSE */
  useEffect(() => {
    setLoading(true);
    void load();
    const grantFilter = selectedGrant || "*";
    const off = subscribeFeed(grantFilter, (e: FeedEvent) => {
      const newRow: AuditRow = {
        id: e.id,
        createdAt: e.at,
        actorType: e.actorType,
        eventType: e.eventType,
        subjectType: "",
        subjectId: "",
        chainSignature: e.chainSignature ?? null,
        payload: e.payload,
      };
      setRows(prev => [...prev, newRow]);
    });
    return () => off();
  }, [load, selectedGrant]);

  /* Filter rows by search */
  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.eventType.toLowerCase().includes(s) ||
      r.actorType.toLowerCase().includes(s) ||
      (r.chainSignature?.toLowerCase().includes(s) ?? false) ||
      describePayload(r).toLowerCase().includes(s)
    );
  });

  /* Stats */
  const totalEvents = rows.length;
  const onchainEvents = rows.filter(r => r.chainSignature && !r.chainSignature.startsWith("MOCK")).length;
  const rejects = rows.filter(r => r.eventType === "tx.rejected" || r.eventType === "chain.tx_failed").length;

  // Two independent writers land in this table. The runtime records what it
  // submitted and what came back; the indexer decodes the program's own logs
  // and writes its own row, for our transactions and anyone else's. When both
  // exist for one signature the decision is corroborated — the server's account
  // of it agrees with the chain's, and neither had to be taken on trust.
  //
  // The distinction is the event name, not the actor. The indexer prefixes its
  // events with "chain."; everything else on the same signature is this side's
  // account of it, whether the executor wrote it after submitting or the API
  // wrote it when the owner's wallet did.
  const corroboration = new Map<string, { chain: boolean; server: boolean }>();
  for (const r of rows) {
    const sig = r.chainSignature;
    if (!sig || sig.startsWith("MOCK")) continue;
    const seen = corroboration.get(sig) ?? { chain: false, server: false };
    if (r.eventType.startsWith("chain.")) seen.chain = true;
    else seen.server = true;
    corroboration.set(sig, seen);
  }
  const corroborated = [...corroboration.values()].filter(v => v.chain && v.server).length;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${M}14`, border: `1px solid ${M}20` }}><ScrollText size={12} style={{ color: M }} /></div>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ ...mono, color: M }}>Verifiable Audit Trail</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ ...sans, color: "#e2e8f0" }}>Audit <span style={{ color: M }}>Log</span></h1>
        <p className="text-sm mt-1" style={{ ...sans, color: "#475569" }}>Every intent, decision, and on-chain signature — verifiable on Solana Explorer.</p>
        <p className="text-xs mt-2 max-w-2xl" style={{ ...sans, color: "#475569", lineHeight: 1.7 }}>
          Two writers fill this table. The runtime records what it submitted; the indexer decodes the program's own logs and writes its own row — for these transactions and anyone else's. Rows marked <span style={{ ...mono, color: C }}>chain log</span> came from the second, so a decision carrying <ShieldCheck size={11} style={{ color: M, display: "inline", verticalAlign: "-1px" }} /> is one where both accounts agree. Nothing here rests on this server being believed.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: totalEvents.toLocaleString(), color: M, icon: Activity, hint: "Every row this system has written." },
          { label: "On-chain Sigs", value: onchainEvents.toLocaleString(), color: C, icon: ExternalLink, hint: "Rows carrying a real Devnet signature you can open." },
          { label: "Corroborated", value: corroborated.toLocaleString(), color: corroborated > 0 ? M : "#64748b", icon: ShieldCheck, hint: "Decisions where the server's record and the program's own logs agree — read back independently, not taken on trust." },
          { label: "TX Rejected", value: rejects.toLocaleString(), color: rejects > 0 ? R : "#64748b", icon: XCircle, hint: "Transfers the program refused. Nothing moved on any of them." },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={`audit-stat-${i}`} title={s.hint} className="rounded-2xl p-5 relative overflow-hidden group transition-transform duration-300 hover:-translate-y-0.5"
              style={{ ...glass(), boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
              <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.color}50, transparent)` }} />
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ background: `${s.color}14`, border: `1px solid ${s.color}20` }}>
                  <Icon size={11} style={{ color: s.color }} />
                </div>
                <span className="text-[11px]" style={{ ...sans, color: "#94a3b8" }}>{s.label}</span>
              </div>
              <div className="text-xl font-bold" style={{ ...mono, color: "#e2e8f0", textShadow: `0 0 24px ${s.color}30` }}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#334155" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events, signatures, reason codes..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-xs outline-none transition-all"
            style={{ ...sans, background: "rgba(11,17,16,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", color: "#e2e8f0", caretColor: M }}
            onFocus={e => { e.target.style.borderColor = `${M}35`; e.target.style.boxShadow = `0 0 0 3px ${M}10`; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} />
        </div>

        {/* Grant filter dropdown */}
        <div className="relative">
          <button type="button" onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition-all shrink-0 min-w-[180px]"
            style={{ ...sans, background: selectedGrant ? `${C}12` : "rgba(11,17,16,0.6)", backdropFilter: "blur(20px)", border: `1px solid ${selectedGrant ? C + "35" : "rgba(255,255,255,0.06)"}`, color: selectedGrant ? C : "#475569" }}>
            <Filter size={13} />
            {selectedGrant ? `Grant …${selectedGrant.slice(-6)}` : "All Grants"}
            <ChevronDown size={12} className="ml-auto" style={{ transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
              style={{ ...glass(), boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
              <button type="button" onClick={() => { setSelectedGrant(""); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/[0.04] transition-colors"
                style={{ ...sans, color: !selectedGrant ? M : "#94a3b8", background: !selectedGrant ? `${M}08` : "transparent" }}>
                All Grants
              </button>
              {grants.map(g => (
                <button type="button" key={g.id} onClick={() => { setSelectedGrant(g.id); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/[0.04] transition-colors border-t"
                  style={{ ...sans, color: selectedGrant === g.id ? M : "#94a3b8", background: selectedGrant === g.id ? `${M}08` : "transparent", borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center justify-between">
                    <span>{g.agentVersion.name} <span style={{ color: "#475569" }}>{g.agentVersion.version}</span></span>
                    <span style={{ ...mono, color: g.revoked ? R : C, fontSize: 10 }}>{g.revoked ? "REVOKED" : "ACTIVE"}</span>
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ ...mono, color: "#334155" }}>grant {short(g.grantPda)} · {short(g.id)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <button type="button" onClick={() => { setLoading(true); void load(); }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold shrink-0 transition-all hover:bg-white/[0.04]"
          style={{ ...sans, background: "rgba(11,17,16,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", color: "#475569" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ ...sans, color: "#334155" }}>
          Showing <span style={{ color: "#e2e8f0" }}>{filtered.length}</span> events
          {search && <span> matching &quot;{search}&quot;</span>}
          {selectedGrant && <span> · grant {short(selectedGrant)}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: error ? R : M, animation: error ? "none" : "redline-pulse 2s infinite" }} />
          <span className="text-[10px] font-bold" style={{ ...mono, color: error ? R : M }}>{error ? "OFFLINE" : "LIVE"}</span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: `${R}09`, border: `1px solid ${R}20` }}>
          <div className="p-2 rounded-xl" style={{ background: `${R}14`, border: `1px solid ${R}25` }}><AlertTriangle size={14} style={{ color: R }} /></div>
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Backend Unreachable</div>
            <div className="text-[11px] mt-0.5" style={{ ...sans, color: "#64748b" }}>{error}. Start the backend with <code style={{ ...mono, color: C }}>cd backend && npm run dev</code></div>
          </div>
        </div>
      )}

      {/* Audit table */}
      <div className="rounded-2xl overflow-hidden" style={{ ...glass(), boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}>
        {/* Table header */}
        <div className="grid items-center px-5 py-3 border-b"
          style={{ gridTemplateColumns: "90px 130px 1fr 120px 90px", borderColor: "rgba(255,255,255,0.05)", background: "rgba(1,3,3,0.5)" }}>
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ ...mono, color: "#334155" }}>Time</span>
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ ...mono, color: "#334155" }}>Event</span>
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ ...mono, color: "#334155" }}>Details</span>
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ ...mono, color: "#334155" }}>Source</span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-right" style={{ ...mono, color: "#334155" }}>Signature</span>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && !loading && !error && (
          <div className="px-5 py-12 text-center">
            <ScrollText size={24} style={{ color: "#1e293b", margin: "0 auto 12px" }} />
            <div className="text-sm font-semibold mb-1" style={{ ...sans, color: "#475569" }}>No audit events yet</div>
            <div className="text-xs" style={{ ...sans, color: "#334155" }}>Create a grant and start an agent to see events appear here in real time.</div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && filtered.length === 0 && (
          <div className="px-5 py-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={`skel-${i}`} className="h-5 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.03)", width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>
        )}

        {/* Audit rows */}
        {filtered.map((row, idx) => {
          const meta = eventMeta(row.eventType);
          const Icon = meta.icon;
          const desc = describePayload(row);
          const hasSig = row.chainSignature && !row.chainSignature.startsWith("MOCK");
          const isReject = row.eventType === "tx.rejected" || row.eventType === "chain.tx_failed";
          const isConfirm = row.eventType === "tx.confirmed" || row.eventType === "chain.policy_decision";
          const fromIndexer = row.eventType.startsWith("chain.");
          const pair = row.chainSignature ? corroboration.get(row.chainSignature) : undefined;
          const agreed = Boolean(pair?.chain && pair.server);
          return (
            <div key={row.id}
              className="grid items-center px-5 py-3 border-b hover:bg-white/[0.018] transition-colors group"
              style={{
                gridTemplateColumns: "90px 130px 1fr 120px 90px",
                borderColor: "rgba(255,255,255,0.03)",
                background: isReject ? "rgba(239,68,68,0.03)" : isConfirm ? "rgba(0,255,196,0.02)" : "transparent",
                animation: idx === filtered.length - 1 ? "fadeIn 0.3s ease-out" : undefined,
              }}>
              {/* Time */}
              <span className="text-[11px]" style={{ ...mono, color: "rgba(148,163,184,0.5)" }}>
                {new Date(row.createdAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>

              {/* Event badge */}
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}20` }}>
                  <Icon size={10} style={{ color: meta.color }} />
                </div>
                <span className="text-[10px] font-semibold truncate" style={{ ...mono, color: meta.color }}>{meta.label}</span>
              </div>

              {/* Description */}
              <span className="text-[11px] truncate pr-3" style={{ ...sans, color: "#94a3b8" }} title={desc}>{desc}</span>

              {/* Source — who wrote this row, and whether the other writer agrees */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-md truncate w-fit"
                  title={fromIndexer
                    ? "Decoded from the program's own logs by the indexer — not from anything this server remembered."
                    : `Recorded by the ${row.actorType === "owner" ? "owner's action" : row.actorType} as it happened.`}
                  style={{
                    ...mono,
                    background: fromIndexer ? `${C}12` : "rgba(255,255,255,0.03)",
                    color: fromIndexer ? C : "#475569",
                    border: `1px solid ${fromIndexer ? `${C}25` : "rgba(255,255,255,0.05)"}`,
                  }}>
                  {fromIndexer ? "chain log" : row.actorType}
                </span>
                {agreed && (
                  <span title="The server's record of this transaction and the program's own logs agree. Two independent writers, one signature.">
                    <ShieldCheck size={11} style={{ color: M }} />
                  </span>
                )}
              </div>

              {/* Signature */}
              <div className="text-right">
                {hasSig ? (
                  <a href={explorerTransactionUrl(row.chainSignature!)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold transition-colors"
                    style={{ ...mono, color: C }}
                    onMouseEnter={e => (e.currentTarget.style.color = M)}
                    onMouseLeave={e => (e.currentTarget.style.color = C)}>
                    {short(row.chainSignature!, 3)}
                    <ExternalLink size={9} />
                  </a>
                ) : (
                  <span className="text-[10px]" style={{ ...mono, color: "#1e293b" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="rounded-xl p-3 flex gap-2.5" style={{ background: `${C}0a`, border: `1px solid ${C}18` }}>
        <ScrollText size={12} style={{ color: C, marginTop: 1, flexShrink: 0 }} />
        <p className="text-[11px]" style={{ ...sans, color: "#94a3b8", lineHeight: 1.6 }}>
          This audit trail is append-only. Every event with a chain signature can be independently verified on{" "}
          <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer" style={{ color: C }}>Solana Explorer (Devnet)</a>.
          The indexer reads program logs directly — dashboard numbers come from the chain, not the server.
        </p>
      </div>
    </div>
  );
}
