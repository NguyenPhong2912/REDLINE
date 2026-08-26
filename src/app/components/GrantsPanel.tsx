import { useCallback, useEffect, useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { ExternalLink, Key, LoaderCircle, Play, ShieldOff, Zap } from "lucide-react";
import { api, fmtUsdc, short, subscribeFeed, type Grant } from "../lib/api";
import type { AppClient } from "../solana/client";
import { explorerTransactionUrl } from "../solana/client";
import { revokeGrantInstruction } from "../solana/redline";

const M = "#00ffc4", C = "#06b6d4", A = "#e2b714", R = "#ef4444";
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const sans: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };

// Real grants from the API with the three demo controls:
//   Start agent  → POST /runs (scripted: 3 compliant transfers + 1 over cap)
//   Force over-cap → POST /intents submitEvenIfDenied (program rejects on-chain)
//   Revoke → owner signs revoke_grant in the wallet, API records the signature
export function GrantsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [chain, setChain] = useState<"mock" | "solana" | "">("");

  const load = useCallback(async () => {
    try {
      const list = await api.grants();
      const withChain = await Promise.all(list.map(g => api.grant(g.id).catch(() => g)));
      setGrants(withChain);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "API unreachable");
    }
  }, []);

  useEffect(() => { void load(); api.health().then(h => setChain(h.chain)).catch(() => setChain("")); }, [load, refreshKey]);
  useEffect(() => subscribeFeed("*", () => { void load(); }), [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setError("");
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }

  async function revoke(g: Grant) {
    const owner = connected ? String(connected.account.address) : "";
    if (chain === "solana" && owner === g.owner.wallet && connected?.signer) {
      const result = await client.sendTransaction([await revokeGrantInstruction(owner, g.grantPda)]);
      await api.revoke(g.id, String(result.context.signature));
    } else {
      await api.revoke(g.id); // mock, or headless demo owner on the server
    }
  }

  const activeRun = (g: Grant) => g.runs?.find(r => r.status === "running");

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(11,17,16,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="text-sm font-semibold" style={{ ...sans, color: "#e2e8f0" }}>Active Policy Accounts</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: `${M}14`, color: M, border: `1px solid ${M}25` }}>
          {grants.filter(g => !g.revoked).length} active · {chain || "api offline"}
        </span>
      </div>
      {error && <div className="px-5 py-2 text-[11px]" style={{ ...mono, color: R }}>{error}</div>}
      {grants.length === 0 && !error && <div className="px-5 py-6 text-[11px]" style={{ ...mono, color: "#334155" }}>No grants yet — create one in the wizard below.</div>}
      {grants.map(g => {
        const oc = g.onchain;
        const cap = Number(g.policyVersion.spendCapUnits);
        const spent = Number(oc?.spentUnits ?? g.spentUnits);
        const pct = cap ? Math.min(100, (spent / cap) * 100) : 0;
        const revoked = g.revoked || oc?.active === false;
        const running = activeRun(g);
        const accent = revoked ? R : running ? M : C;
        const dest = (JSON.parse(g.policyVersion.allowedDests) as string[])[0];
        const mint = (JSON.parse(g.policyVersion.allowedMints) as string[])[0];
        return (
          <div key={g.id} className="px-5 py-4 border-b space-y-3" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}><Key size={13} style={{ color: accent }} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ ...sans, color: "#e2e8f0" }}>{g.agentVersion.name} <span style={{ color: "#475569" }}>{g.agentVersion.version}</span></div>
                <div className="text-[10px] flex gap-3" style={{ ...mono, color: C }}>
                  <span title={g.grantPda}>grant {short(g.grantPda)}</span>
                  <span style={{ color: "#475569" }} title={g.policyVersion.policyHash}>policy {g.policyVersion.policyHash.slice(0, 8)}…</span>
                  {g.createSignature && !g.createSignature.startsWith("MOCK") && <a href={explorerTransactionUrl(g.createSignature)} target="_blank" rel="noreferrer" style={{ color: C }}>explorer <ExternalLink size={9} className="inline" /></a>}
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-[11px] font-semibold" style={{ ...mono, color: A }}>{fmtUsdc(spent)} / {fmtUsdc(cap)} USDC</div>
                <div className="text-[10px]" style={{ ...mono, color: "#475569" }}>tx {oc?.transactionCount ?? g.transactionCount}/{g.policyVersion.maxTransactions} · nonce {oc?.nextNonce ?? g.nextNonce}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ ...mono, background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, animation: running ? "redline-pulse 2s infinite" : "none" }} />
                {revoked ? "REVOKED" : running ? "AGENT RUNNING" : "ACTIVE"}
              </span>
            </div>
            <div className="relative rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", height: 3 }}>
              <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${A}60, ${A})` }} />
            </div>
            {!revoked && (
              <div className="flex flex-wrap gap-2">
                <Btn icon={Play} label={running ? "Agent running…" : "Start agent (scripted)"} accent={M} disabled={!!running || !!busy} busy={busy === `run-${g.id}`} onClick={() => run(`run-${g.id}`, () => api.startRun(g.id))} />
                <Btn icon={Zap} label={`Force ${fmtUsdc(cap)} USDC (over cap)`} accent={A} disabled={!!busy} busy={busy === `force-${g.id}`}
                  onClick={() => run(`force-${g.id}`, () => api.submitIntent({ grantId: g.id, mint, amountUnits: String(cap), destination: dest, reason: "Manual over-cap attempt from dashboard", submitEvenIfDenied: true }))} />
                <Btn icon={ShieldOff} label="Revoke" accent={R} disabled={!!busy} busy={busy === `revoke-${g.id}`} onClick={() => run(`revoke-${g.id}`, () => revoke(g))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Btn({ icon: Icon, label, accent, onClick, disabled, busy }: { icon: React.ElementType; label: string; accent: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
      style={{ ...sans, background: `${accent}12`, border: `1px solid ${accent}30`, color: accent }}>
      {busy ? <LoaderCircle size={11} className="animate-spin" /> : <Icon size={11} />}{label}
    </button>
  );
}
