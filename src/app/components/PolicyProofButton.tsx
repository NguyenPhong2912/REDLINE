import { useState } from "react";
import { getAddMemoInstruction } from "@solana-program/memo";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { CheckCircle2, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import type { AgentPolicyInput, RiskAssessment } from "../lib/risk-engine";
import { policyDigest } from "../lib/risk-engine";
import type { AppClient } from "../solana/client";
import { explorerTransactionUrl } from "../solana/client";

const ACCENT = "#00ffc4";

export function PolicyProofButton({ policy, assessment }: { policy: AgentPolicyInput; assessment: RiskAssessment | null }) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = assessment?.decision === "BLOCK";

  async function signPolicy() {
    if (!connected?.signer || blocked) return;
    setPending(true);
    setError("");
    try {
      const digest = await policyDigest(policy);
      const memo = getAddMemoInstruction({ memo: `REDLINE_POLICY_V1:${digest}` });
      const result = await client.sendTransaction([memo]);
      setSignature(String(result.context.signature));
    } catch {
      setError("Transaction was rejected or could not reach Solana Devnet. Check the wallet balance and try again.");
    } finally {
      setPending(false);
    }
  }

  if (signature) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold" style={{ color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}>
          <CheckCircle2 size={13} /> Policy proof confirmed on Devnet
        </div>
        <a className="flex items-center justify-center gap-1 text-[10px]" style={{ color: "#06b6d4" }} href={explorerTransactionUrl(signature)} target="_blank" rel="noreferrer">
          View transaction on Solana Explorer <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={signPolicy}
        disabled={!connected?.signer || pending || blocked}
        className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: `linear-gradient(135deg, ${ACCENT}dd, #06b6d4cc)`, color: "#040707" }}
      >
        {pending ? <LoaderCircle size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
        {blocked ? "Blocked by risk policy" : connected ? "Sign & publish policy proof" : "Connect wallet to publish proof"}
      </button>
      <p className="text-[10px] text-center" style={{ color: "#475569" }}>
        Writes only the SHA-256 policy digest through Solana Memo; no funds are transferred beyond the network fee.
      </p>
      {error && <p role="alert" className="text-[10px] text-center" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
