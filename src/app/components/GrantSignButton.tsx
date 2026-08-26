import { useEffect, useState } from "react";
import { address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { CheckCircle2, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import type { AgentPolicyInput, RiskAssessment } from "../lib/risk-engine";
import { api, type Health } from "../lib/api";
import type { AppClient } from "../solana/client";
import { explorerTransactionUrl } from "../solana/client";
import { createGrantInstruction, findVaultPda, initVaultInstruction, policyHashHex, randomAgentId, toHex } from "../solana/redline";

const ACCENT = "#00ffc4";
const CYAN = "#06b6d4";
const USDC_MINT = import.meta.env.VITE_DEMO_USDC_MINT ?? "";
const OPS_DESTINATION = import.meta.env.VITE_DEMO_OPS_DESTINATION ?? "";

// Owner-side flow, all signed in the browser wallet:
//   1. init_vault if this wallet has no vault yet (+ ask the API to mint demo USDC into it)
//   2. create_grant with the reviewed policy's hash and limits
//   3. tell the API the grant exists (grantPda + signature) so the runtime can use it
// The backend never sees the owner's key.
export function GrantSignButton({ policy, assessment, onCreated }: { policy: AgentPolicyInput; assessment: RiskAssessment | null; onCreated?: (grantId: string) => void }) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const [health, setHealth] = useState<Health | null>(null);
  const [apiError, setApiError] = useState("");
  const [phase, setPhase] = useState<"idle" | "vault" | "grant" | "register" | "done">("idle");
  const [signature, setSignature] = useState("");
  const [grantId, setGrantId] = useState("");
  const [error, setError] = useState("");
  const blocked = assessment?.decision === "BLOCK";

  useEffect(() => {
    api.health().then(setHealth).catch(e => setApiError(e instanceof Error ? e.message : "API unreachable"));
  }, []);

  async function sign() {
    if (!connected?.signer || blocked || !health) return;
    setError("");
    const owner = String(connected.account.address);
    try {
      // 1. vault
      setPhase("vault");
      const vaultPda = await findVaultPda(owner);
      const { value: vaultAccount } = await client.rpc.getAccountInfo(address(vaultPda), { encoding: "base64" }).send();
      if (!vaultAccount) {
        await client.sendTransaction([await initVaultInstruction(owner)]);
        await api.fundVault(owner); // demo USDC so the agent has something to move
      }

      // 2. grant
      setPhase("grant");
      const agentId = randomAgentId();
      const allowedMints = [USDC_MINT];
      const allowedDestinations = [OPS_DESTINATION];
      const full = { ...policy, allowedMints, allowedDestinations };
      const hash = await policyHashHex(full);
      const now = Math.floor(Date.now() / 1000);
      const { instruction, grantPda } = await createGrantInstruction({
        owner, executor: health.executor, agentId, policyHashHex: hash,
        spendCapUnits: BigInt(Math.round(policy.spendCapUsdc * 1_000_000)),
        maxTransactions: policy.maxTransactions,
        expiresAt: now + policy.durationHours * 3600,
        cooldownSeconds: policy.cooldownMinutes * 60,
        allowedMints, allowedDestinations,
      });
      const result = await client.sendTransaction([instruction]);
      const sig = String(result.context.signature);
      setSignature(sig);

      // 3. register
      setPhase("register");
      const agents = await api.agents();
      const agent = agents[0] ?? (await api.publishAgent({ name: policy.agentName, version: "v0.1.0", strategy: policy.strategy, modelRef: "openai:gpt-5.4-mini", codeRef: "git:redline-runtime@main" })).agent;
      const created = await api.createGrant({ ownerWallet: owner, vaultPda, agentVersionId: agent.id, grantPda, createSignature: sig, agentId: toHex(agentId), policy: full });
      setGrantId(created.grant.id);
      setPhase("done");
      onCreated?.(created.grant.id);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Transaction was rejected or could not reach Solana Devnet.");
    }
  }

  if (phase === "done") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold" style={{ color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}>
          <CheckCircle2 size={13} /> Grant live on Devnet · id {grantId.slice(-6)}
        </div>
        <a className="flex items-center justify-center gap-1 text-[10px]" style={{ color: CYAN }} href={explorerTransactionUrl(signature)} target="_blank" rel="noreferrer">
          View create_grant on Solana Explorer <ExternalLink size={10} />
        </a>
        <p className="text-[10px] text-center" style={{ color: "#475569" }}>Open Agent Guardrails → Active Policy Accounts to start the agent.</p>
      </div>
    );
  }

  const label = apiError ? "Backend offline" : !connected ? "Connect wallet to sign grant"
    : blocked ? "Blocked by risk policy"
    : phase === "vault" ? "Creating vault…" : phase === "grant" ? "Sign create_grant…" : phase === "register" ? "Registering…"
    : "Sign & create on-chain grant";
  const busy = phase !== "idle";

  return (
    <div className="space-y-2">
      <button type="button" onClick={sign} disabled={!connected?.signer || busy || blocked || !!apiError || !health}
        className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: `linear-gradient(135deg, ${ACCENT}dd, ${CYAN}cc)`, color: "#040707" }}>
        {busy ? <LoaderCircle size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
        {label}
      </button>
      <p className="text-[10px] text-center" style={{ color: "#475569" }}>
        {health ? `Program ${health.programId.slice(0, 6)}… · executor ${health.executor.slice(0, 6)}… · ${health.chain}` : apiError ? `API: ${apiError}` : "Connecting to REDLINE API…"}
      </p>
      {error && <p role="alert" className="text-[10px] text-center" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
