import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, FlaskConical, RotateCcw } from "lucide-react";
import { api, fmtUsdc, type PolicyPreset, type SimulationResult } from "../lib/api";
import { playSound } from "../lib/soundscape";

const gateLabels = ["Active", "Expiry", "Nonce", "Asset", "Recipient", "Budget", "Cooldown"];
export function PolicyLab() {
  const [presets, setPresets] = useState<PolicyPreset[]>([]);
  const [preset, setPreset] = useState<PolicyPreset | null>(null);
  const [amount, setAmount] = useState("250");
  const [attempts, setAttempts] = useState("5");
  const [interval, setInterval] = useState("60");
  const [scenario, setScenario] = useState("normal");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const revision = useRef(0);
  const loadRevision = useRef(0);
  const mounted = useRef(true);

  function choose(value: PolicyPreset) {
    revision.current += 1;
    setPreset(value); setAmount(String(Number(value.proposal.amountUnits) / 1e6));
    setAttempts(String(value.proposal.attempts)); setInterval(String(value.proposal.intervalSeconds));
    setScenario("normal"); setResult(null); setError("");
  }
  async function load() {
    const current = ++loadRevision.current;
    setLoading(true); setError("");
    try {
      const response = await api.policyPresets();
      if (!mounted.current || current !== loadRevision.current) return;
      if (!response.presets.length) throw new Error("No policy presets available.");
      setPresets(response.presets); choose(response.presets[0]);
    } catch { if (mounted.current && current === loadRevision.current) setError("Policy Lab cannot reach the API. Start the updated backend, then retry."); }
    finally { if (mounted.current && current === loadRevision.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; revision.current += 1; loadRevision.current += 1; }; }, []);
  function invalidate() { revision.current += 1; setResult(null); setError(""); }
  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!preset || running) return;
    if (!/^\d+(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) { setError("Enter a positive amount with up to six decimal places."); return; }
    const [whole, fraction = ""] = amount.split(".");
    const amountUnits = (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"))).toString();
    if (BigInt(amountUnits) > 18_446_744_073_709_551_615n) { setError("Amount exceeds the supported token limit."); return; }
    const current = revision.current;
    setRunning(true); setError(""); setResult(null);
    try {
      const response = await api.simulatePolicy({ policy: preset.policy, proposal: {
        amountUnits, attempts: Number(attempts), intervalSeconds: Number(interval),
        destinationAllowed: scenario !== "recipient", mintAllowed: scenario !== "asset",
        active: scenario !== "revoked", replayNonce: scenario === "replay",
      } });
      if (mounted.current && current === revision.current) { setResult(response); setSelected(0); playSound(response.summary.blocked ? "warning" : "success"); }
    } catch (e) { if (mounted.current && current === revision.current) { setError(e instanceof Error ? e.message : "Simulation failed. Please retry."); playSound("error"); } }
    finally { if (mounted.current) setRunning(false); }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "redline-policy-simulation.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const step = result?.steps[selected];
  return (
    <section className="policy-lab" id="policy-lab" aria-labelledby="lab-title">
      <div className="section-eyebrow"><FlaskConical size={14} /> INTERACTIVE FIELD TEST / 01</div>
      <div className="lab-heading"><h2 id="lab-title">Test the limits.<br /><em>Before they matter.</em></h2><p>Give a hypothetical agent a mission. See how each proposal passes through the same seven policy checks.</p></div>
      {loading ? <p role="status">Loading policy presets…</p> : <>
        {presets.length > 0 && <div className="lab-presets" aria-label="Policy presets">{presets.map(item => <button type="button" key={item.id} onClick={() => choose(item)} aria-pressed={preset?.id === item.id}>{item.name}<ArrowRight size={14} /></button>)}</div>}
        {preset && <div className="lab-workspace">
          <form onSubmit={run} className="lab-form">
            <div className="lab-policy"><span>MISSION PARAMETERS</span><p>{preset.description}</p><dl><div><dt>Budget</dt><dd>{fmtUsdc(preset.policy.spendCapUnits)} USDC</dd></div><div><dt>Transaction cap</dt><dd>{preset.policy.maxTransactions}</dd></div><div><dt>Cooldown</dt><dd>{preset.policy.cooldownSeconds}s</dd></div><div><dt>Expires after</dt><dd>{preset.policy.durationSeconds / 3600}h</dd></div></dl></div>
            <label>Amount per proposal · USDC<input value={amount} onChange={e => { invalidate(); setAmount(e.target.value); }} inputMode="decimal" required maxLength={24} /></label>
            <div className="lab-input-pair"><label>Attempts<input type="number" min="1" max="50" step="1" required value={attempts} onChange={e => { invalidate(); setAttempts(e.target.value); }} /></label><label>Interval · seconds<input type="number" min="0" max="604800" step="1" required value={interval} onChange={e => { invalidate(); setInterval(e.target.value); }} /></label></div>
            <label>Scenario<select value={scenario} onChange={e => { invalidate(); setScenario(e.target.value); }}><option value="normal">Follow the policy</option><option value="recipient">Unapproved recipient</option><option value="asset">Unapproved asset</option><option value="replay">Replay the first nonce</option><option value="revoked">Revoked permission</option></select></label>
            <button type="submit" className="astral-button" disabled={running}>{running ? "Evaluating…" : "Run simulation"}<ArrowRight size={16} /></button>
            <span className="lab-disclaimer">Hypothetical only · no wallet · no transfers</span>
          </form>
          <div className="lab-results" aria-live="polite" aria-busy={running}>
            {result && step ? <>
              <div className="lab-result-summary"><span><b>{result.summary.allowed}</b> passed</span><span><b>{result.summary.blocked}</b> blocked</span><button type="button" onClick={download} aria-label="Download simulation report"><Download size={17} /></button></div>
              <div className="lab-attempts" aria-label="Inspect a proposal">{result.steps.map((item, index) => <button type="button" key={index} onClick={() => setSelected(index)} aria-pressed={selected === index} data-allowed={item.verdict.allow}>{String(item.attempt).padStart(2, "0")}</button>)}</div>
              <div className="lab-gates">{step.gates.map((gate, index) => <div key={gate.id} data-state={gate.status}><span>{String(gate.id).padStart(2, "0")}</span><b>{gateLabels[index]}</b><small>{gate.status}</small></div>)}</div>
              <div className="lab-verdict" data-allowed={step.verdict.allow}><span>PROPOSAL {step.attempt} · T + {step.elapsedSeconds}s</span><h3>{step.verdict.reasonCode}</h3><p>{step.verdict.message}</p></div>
              <div className="lab-balance"><span>Remaining after this proposal</span><strong>{fmtUsdc(step.remainingUnits)} USDC</strong></div>
              <p className="lab-disclaimer">{result.notice}</p>
            </> : <div className="lab-empty"><FlaskConical size={44} strokeWidth={1} /><span>AWAITING YOUR PROPOSAL</span><h3>Every boundary tells a story.</h3><p>Choose a mission and run a simulation to inspect the gate-by-gate result.</p><div className="lab-empty-gates">{gateLabels.map((_, i) => <i key={i}>{i + 1}</i>)}</div></div>}
          </div>
        </div>}
      </>}
      {error && <div role="alert" className="lab-error">{error}{!presets.length && <button type="button" onClick={() => void load()}><RotateCcw size={14} /> Retry connection</button>}</div>}
    </section>
  );
}
