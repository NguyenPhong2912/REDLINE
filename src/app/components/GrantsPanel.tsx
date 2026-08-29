import { useCallback, useEffect, useState } from "react";
import { useConnectedWallet, useSignMessage } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { ChevronRight, ExternalLink, Key, LoaderCircle, Play, ShieldOff, Zap } from "lucide-react";
import { api, fmtUsdc, short, subscribeFeed, type Grant, type IntentRow } from "../lib/api";
import { sessionFor, signIn } from "../lib/signin";
import type { AppClient } from "../solana/client";
import { explorerTransactionUrl } from "../solana/client";
import { revokeGrantInstruction } from "../solana/redline";
import { color, mono, sans } from "../theme";

const M = color.primary, C = color.info, A = color.warn, R = color.danger;

// Real grants from the API with the three demo controls:
//   Start agent  → POST /runs (scripted: 3 compliant transfers + 1 over cap)
//   Force over-cap → POST /intents submitEvenIfDenied (program rejects on-chain)
//   Revoke → owner signs revoke_grant in the wallet, API records the signature
export function GrantsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const signMessage = useSignMessage(client);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [chain, setChain] = useState<"mock" | "solana" | "">("");
  const [openGrant, setOpenGrant] = useState("");
  const [intents, setIntents] = useState<Record<string, IntentRow[]>>({});

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
  // The feed refreshes the grant rows; the open history has to follow it, or a
  // panel left open while the agent runs keeps showing the proposals that
  // existed when it was opened and silently omits every one since.
  const loadIntents = useCallback(async (grantId: string) => {
    try {
      const rows = await api.intents(grantId);
      setIntents(prev => ({ ...prev, [grantId]: rows }));
    } catch {
      // An empty list is the honest thing to show; the panel says so in words.
      setIntents(prev => ({ ...prev, [grantId]: prev[grantId] ?? [] }));
    }
  }, []);

  useEffect(() => subscribeFeed("*", () => {
    void load();
    if (openGrant) void loadIntents(openGrant);
  }), [load, loadIntents, openGrant]);

  // Starting a run or forcing an intent makes the executor spend from this
  // grant's vault, so the API asks for a session proving the caller owns it.
  // Get one on demand rather than sending the user off to find a button.
  async function withSession(owner: string) {
    if (sessionFor(owner)) return;
    await signIn(m => signMessage.dispatchAsync(m), owner);
  }

  async function run(label: string, fn: () => Promise<unknown>, owner?: string) {
    setBusy(label); setError("");
    try {
      if (owner) await withSession(owner);
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(""); }
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

  // Per-grant proposal history. The API has always returned this; nothing in
  // the dashboard ever asked for it, so a grant showed aggregate counters and
  // the reason behind any single decision lived only in a flat feed.
  async function toggleIntents(grantId: string) {
    if (openGrant === grantId) { setOpenGrant(""); return; }
    setOpenGrant(grantId);
    // Always refetch on open: a cached list from an earlier session of this
    // page would be missing everything the agent did since.
    await loadIntents(grantId);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: color.surface, border: `1px solid ${color.border}` }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: color.border }}>
        <span className="text-sm font-semibold" style={{ ...sans, color: color.text }}>Active Policy Accounts</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: `${M}14`, color: M, border: `1px solid ${M}25` }}>
          {grants.filter(g => !g.revoked).length} active · {chain || "api offline"}
        </span>
      </div>
      {error && <div className="px-5 py-2 text-[11px]" style={{ ...mono, color: R }}>{error}</div>}
      {grants.length === 0 && !error && <div className="px-5 py-6 text-[11px]" style={{ ...mono, color: color.textDim }}>No grants yet — create one in the wizard below.</div>}
      {grants.map(g => {
        const oc = g.onchain;
        const cap = Number(g.policyVersion.spendCapUnits);
        const spent = Number(oc?.spentUnits ?? g.spentUnits);
        const pct = cap ? Math.min(100, (spent / cap) * 100) : 0;
        const revoked = g.revoked || oc?.active === false;
        const running = activeRun(g);
        // Gate 2 is EXPIRED, and until now nothing on this page said when that
        // would happen. An agent that stops because its window closed looks
        // exactly like an agent that broke.
        const expiresAt = new Date(oc ? oc.expiresAt * 1000 : g.policyVersion.expiresAt);
        const msLeft = expiresAt.getTime() - Date.now();
        const expired = msLeft <= 0;
        const expiry = expired ? "expired"
          : msLeft < 3_600_000 ? `${Math.max(1, Math.round(msLeft / 60_000))}m left`
          : msLeft < 86_400_000 ? `${Math.round(msLeft / 3_600_000)}h left`
          : `${Math.round(msLeft / 86_400_000)}d left`;
        const expirySoon = !expired && msLeft < 3_600_000;
        const accent = revoked || expired ? R : running ? M : C;
        const dest = (JSON.parse(g.policyVersion.allowedDests) as string[])[0];
        const mint = (JSON.parse(g.policyVersion.allowedMints) as string[])[0];
        const ownerWallet = connected ? String(connected.account.address) : "";
        const isOwner = ownerWallet === g.owner.wallet;
        return (
          <div key={g.id} className="px-5 py-4 border-b space-y-3" style={{ borderColor: color.border }}>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}><Key size={13} style={{ color: accent }} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ ...sans, color: color.text }}>{g.agentVersion.name} <span style={{ color: color.textDim }}>{g.agentVersion.version}</span></div>
                <div className="text-[10px] flex gap-3" style={{ ...mono, color: C }}>
                  <span title={g.grantPda}>grant {short(g.grantPda)}</span>
                  <span style={{ color: color.textDim }} title={g.policyVersion.policyHash}>policy {g.policyVersion.policyHash.slice(0, 8)}…</span>
                  {g.createSignature && !g.createSignature.startsWith("MOCK") && <a href={explorerTransactionUrl(g.createSignature)} target="_blank" rel="noreferrer" style={{ color: C }}>explorer <ExternalLink size={9} className="inline" /></a>}
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-[11px] font-semibold" style={{ ...mono, color: A }}>{fmtUsdc(spent)} / {fmtUsdc(cap)} USDC</div>
                <div className="text-[10px]" style={{ ...mono, color: color.textDim }}>
                  tx {oc?.transactionCount ?? g.transactionCount}/{g.policyVersion.maxTransactions} · nonce {oc?.nextNonce ?? g.nextNonce} ·{" "}
                  <span title={`Gate 2 refuses every transfer after ${expiresAt.toLocaleString()}`} style={{ color: expired ? R : expirySoon ? A : color.textDim }}>{expiry}</span>
                  {g.hire && <> · <span title={`Runs under a marketplace rental ending ${new Date(g.hire.endsAt).toLocaleString()}`} style={{ color: C }}>rented</span></>}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ ...mono, background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, animation: running ? "redline-pulse 2s infinite" : "none" }} />
                {revoked ? "REVOKED" : expired ? "EXPIRED" : running ? "AGENT RUNNING" : "ACTIVE"}
              </span>
            </div>
            <div className="relative rounded-full overflow-hidden" style={{ background: color.surfaceInset, height: 3 }}>
              <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${A}60, ${A})` }} />
            </div>
            {!revoked && (
              <div className="flex flex-wrap gap-2">
                {isOwner ? (
                  <>
                    <Btn icon={Play} label={running ? "Agent running…" : "Start agent (scripted)"} accent={M} disabled={!!running || !!busy} busy={busy === `run-${g.id}`} onClick={() => run(`run-${g.id}`, () => api.startRun(g.id), g.owner.wallet)} />
                    <Btn icon={Zap} label={`Force ${fmtUsdc(cap)} USDC (over cap)`} accent={A} disabled={!!busy} busy={busy === `force-${g.id}`}
                      onClick={() => run(`force-${g.id}`, () => api.submitIntent({ grantId: g.id, mint, amountUnits: String(cap), destination: dest, reason: "Manual over-cap attempt from dashboard", submitEvenIfDenied: true }), g.owner.wallet)} />
                    <Btn icon={ShieldOff} label="Revoke" accent={R} disabled={!!busy} busy={busy === `revoke-${g.id}`} onClick={() => run(`revoke-${g.id}`, () => revoke(g))} />
                  </>
                ) : (
                  <div className="text-[10px] py-1.5" style={{ ...mono, color: color.textMuted }}>Read-only · Connect owner wallet to manage</div>
                )}
              </div>
            )}

            <button type="button" onClick={() => void toggleIntents(g.id)} aria-expanded={openGrant === g.id}
              className="flex items-center gap-1.5 text-[10px] pt-0.5" style={{ ...mono, color: color.textDim }}>
              <ChevronRight size={11} style={{ transform: openGrant === g.id ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              {openGrant === g.id ? "Hide" : "Show"} every proposal this agent made
            </button>

            {openGrant === g.id && (
              <div className="rounded-xl overflow-hidden" style={{ background: color.surfaceSubtle, border: `1px solid ${color.border}` }}>
                {!intents[g.id] ? (
                  <div className="px-3 py-3 text-[10px] flex items-center gap-2" style={{ ...mono, color: color.textDim }}><LoaderCircle size={11} className="animate-spin" /> loading…</div>
                ) : intents[g.id].length === 0 ? (
                  <div className="px-3 py-3 text-[10px]" style={{ ...mono, color: color.textDim }}>No proposals yet — start the agent, or force one over the cap.</div>
                ) : intents[g.id].map(it => {
                  const d = it.decision;
                  const tx = d?.chainTx;
                  // The precheck is advisory; the chain is the authority. Show
                  // both, because a disagreement between them is the single
                  // most interesting thing this table could ever display.
                  const allowed = tx ? tx.result === "success" : d?.allow;
                  const colour = allowed ? M : R;
                  return (
                    <div key={it.id} className="px-3 py-2 border-b last:border-0 flex items-center gap-3" style={{ borderColor: color.border }}>
                      <span className="text-[10px] w-8 shrink-0" style={{ ...mono, color: color.textDim }}>#{it.nonce}</span>
                      <span className="text-[10px] shrink-0" style={{ ...mono, color: color.textSecondary }}>{fmtUsdc(it.amountUnits)} USDC</span>
                      <span className="text-[10px] shrink-0" style={{ ...mono, color: color.textDim }}>→ {short(it.destination, 4)}</span>
                      <span className="text-[10px] flex-1 truncate" style={{ ...sans, color: color.textDim }} title={it.reason}>{it.reason}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0" style={{ ...mono, background: `${colour}12`, color: colour, border: `1px solid ${colour}25` }}>
                        {tx ? (tx.result === "success" ? "moved" : d?.reasonCode ?? "refused") : d ? (d.allow ? "passed precheck" : d.reasonCode) : "pending"}
                      </span>
                      {tx?.signature && !tx.signature.startsWith("MOCK") && (
                        <a href={explorerTransactionUrl(tx.signature)} target="_blank" rel="noreferrer" className="shrink-0" style={{ color: C }} title="Open this transaction on Solana Explorer">
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  );
                })}
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
