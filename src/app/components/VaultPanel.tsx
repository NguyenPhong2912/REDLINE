import { useCallback, useEffect, useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { ArrowDownToLine, ExternalLink, LoaderCircle, RefreshCw, Vault } from "lucide-react";
import { api, fmtUsdc, short, type VaultView } from "../lib/api";
import type { AppClient } from "../solana/client";
import { explorerAddressUrl, explorerTransactionUrl } from "../solana/client";
import { withdrawInstruction } from "../solana/redline";
import { color, mono, sans } from "../theme";

const M = color.primary, C = color.info, A = color.warn, R = color.danger;
const USDC_MINT = import.meta.env.VITE_DEMO_USDC_MINT ?? "";

// The owner's vault: live balance from the chain, Refill (demo faucet via the
// API) and Withdraw (owner signs `withdraw` in the wallet — no gates, the
// owner's key is the authority, which is the whole non-custodial point).
export function VaultPanel() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const [view, setView] = useState<VaultView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [lastSig, setLastSig] = useState("");
  const [amount, setAmount] = useState("100");

  const load = useCallback(async () => {
    if (!owner) { setView(null); return; }
    try { setView(await api.vault(owner)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [owner]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15_000); return () => clearInterval(t); }, [load]);

  async function refill() {
    setBusy("refill"); setError("");
    try { const r = await api.fundVault(owner); setLastSig(r.signature); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }
  async function withdraw() {
    if (!connected?.signer || !view) return;
    setBusy("withdraw"); setError("");
    try {
      const units = BigInt(Math.round(Number(amount) * 1_000_000));
      const result = await client.sendTransaction([await withdrawInstruction(owner, USDC_MINT, units)]);
      setLastSig(String(result.context.signature));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Withdraw was rejected or failed."); } finally { setBusy(""); }
  }

  const balance = view?.balanceUnits ? fmtUsdc(view.balanceUnits) : "—";
  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: color.surface, border: `1px solid ${M}18`, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="absolute top-0 left-12 right-12 h-px" style={{ background: `linear-gradient(90deg, transparent, ${M}60, transparent)` }} />
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${M}14`, border: `1px solid ${M}25` }}><Vault size={18} style={{ color: M }} /></div>
        <div className="flex-1 min-w-[220px]">
          <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ ...mono, color: M }}>Program vault · live from Devnet</div>
          {!owner && <div className="text-sm mt-1" style={{ ...sans, color: color.textMuted }}>Connect a wallet to see its vault.</div>}
          {owner && (
            <>
              <div className="text-3xl font-bold tracking-tight mt-1" style={{ ...mono, color: color.text }}>{balance} <span className="text-base" style={{ color: color.textMuted }}>dUSDC</span></div>
              <div className="text-[10px] mt-1 flex gap-3 flex-wrap" style={{ ...mono, color: color.textDim }}>
                {view && <a href={explorerAddressUrl(view.vaultPda)} target="_blank" rel="noreferrer" style={{ color: C }}>vault {short(view.vaultPda)} <ExternalLink size={9} className="inline" /></a>}
                {view && <span>ata {short(view.vaultAta)}</span>}
                {view && !view.exists && <span style={{ color: A }}>vault not initialised — sign a grant first</span>}
              </div>
            </>
          )}
        </div>
        {owner && (
          <div className="flex items-center gap-2 flex-wrap">
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Withdraw amount in dUSDC" className="w-24 px-3 py-2 rounded-xl text-xs text-right" style={{ ...mono, background: color.surfaceInset, border: `1px solid ${color.border}`, color: color.text }} />
            <Btn icon={ArrowDownToLine} label="Withdraw" accent={A} busy={busy === "withdraw"} disabled={!!busy || !view?.exists || !connected?.signer} onClick={withdraw} />
            <Btn icon={RefreshCw} label="Refill 1,000 (devnet)" accent={M} busy={busy === "refill"} disabled={!!busy} onClick={refill} />
          </div>
        )}
      </div>
      {lastSig && <a className="block mt-3 text-[10px]" style={{ ...mono, color: C }} href={explorerTransactionUrl(lastSig)} target="_blank" rel="noreferrer">last tx {short(lastSig, 6)} ↗</a>}
      {error && <p role="alert" className="mt-3 text-[11px]" style={{ ...mono, color: R }}>{error}</p>}
    </div>
  );
}

function Btn({ icon: Icon, label, accent, onClick, disabled, busy }: { icon: React.ElementType; label: string; accent: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
      style={{ ...sans, background: `${accent}12`, border: `1px solid ${accent}30`, color: accent }}>
      {busy ? <LoaderCircle size={11} className="animate-spin" /> : <Icon size={11} />}{label}
    </button>
  );
}
