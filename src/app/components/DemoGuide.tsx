import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Circle, FlaskConical, X } from "lucide-react";
import { api, isSignedIn, loadSession, type AuditRow, type Grant } from "../lib/api";

// A path through the demo, driven by what has actually happened.
//
// The dashboard has twelve routes. Someone seeing it for the first time — a
// judge with four minutes — lands on Protocol and has to work out for
// themselves that the story is Guardrails, then a run, then the Audit trail.
// Most will not, and the one thing worth seeing is the one thing they miss.
//
// This is not a scripted tour. Every step reads real records and marks itself
// done only when the chain says so, which is the same standard the rest of the
// product holds itself to: a checklist that ticked itself on a timer would be
// exactly the kind of decorative progress REDLINE argues against.

const DISMISSED_KEY = "redline.demoGuide.dismissed";

export interface DemoStep {
  key: string;
  title: string;
  detail: string;
  /** What to look for once you are there — the part a tour usually forgets. */
  look: string;
  /** Route slug, not an index: the shell still maps legacy indices through a
   *  compatibility table, so a number here would not mean what it reads. */
  slug: string;
  done: boolean;
}

export interface DemoProgress {
  steps: DemoStep[];
  completed: number;
  signedIn: boolean;
}

/**
 * Work out where the visitor is from records, not from clicks.
 *
 * Exported and pure so the rules are testable: "the chain refused something"
 * has to mean a real rejection, and nothing else.
 */
export function deriveProgress(grants: Grant[], audit: AuditRow[], signedIn: boolean): DemoProgress {
  const hasGrant = grants.length > 0;
  const ran = audit.some(row => row.eventType === "run.started" || row.eventType === "intent.created");
  // The moment the whole product exists for: a proposal the program refused.
  // Only an on-chain rejection counts — a local precheck is the server's
  // opinion, and the claim being demonstrated is that the chain decides.
  const refused = audit.some(row =>
    row.eventType === "tx.rejected" ||
    row.eventType === "chain.tx_failed" ||
    row.eventType === "swap.reverted");
  const revoked = grants.some(g => g.revoked) || audit.some(row => row.eventType === "grant.revoked");

  const steps: DemoStep[] = [
    {
      key: "grant",
      title: "Sign a boundary",
      detail: signedIn
        ? "Guardrails → build a policy → Sign & create on-chain grant. Use a small cap: 500 USDC, 5 transfers."
        : "Connect a Devnet wallet and sign in from the top bar, then open Guardrails.",
      look: "The wallet signs once. From here the limits live on Solana, not in this dashboard.",
      slug: "guardrails",
      done: hasGrant,
    },
    {
      key: "run",
      title: "Let the agent operate",
      detail: "On the grant you just made, press Start agent. It proposes transfers inside the policy.",
      look: "Counters move on the grant itself — they are read back from the chain, not from the server.",
      slug: "guardrails",
      done: ran,
    },
    {
      key: "refused",
      title: "Watch the chain refuse one",
      detail: "The agent tries to spend past the cap. Or press Force over-cap to skip the wait.",
      look: "The transaction lands on Solana and fails with SPEND_CAP_EXCEEDED. Open the explorer link: the token balances before and after are identical. Nothing moved.",
      slug: "audit",
      done: refused,
    },
    {
      key: "revoke",
      title: "Take the authority back",
      detail: "Revoke the grant from your wallet, then let the agent try again.",
      look: "It now fails with Revoked. The owner did not ask the agent to stop — the program stopped accepting it.",
      slug: "guardrails",
      done: revoked,
    },
  ];
  return { steps, completed: steps.filter(s => s.done).length, signedIn };
}

export function DemoGuide({ navigate }: { navigate?: (slug: string) => void }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
  });
  const [progress, setProgress] = useState<DemoProgress | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Both reads are scoped to the caller by the API, so an anonymous visitor
    // sees an empty checklist rather than someone else's progress.
    const [grants, audit] = await Promise.all([
      api.grants().catch(() => [] as Grant[]),
      api.audit().catch(() => [] as AuditRow[]),
    ]);
    setProgress(deriveProgress(grants, audit, isSignedIn(wallet)));
  }, [wallet]);

  useEffect(() => {
    // Signing in happens in the header, which React cannot subscribe to, so
    // the guide polls its own view of the session rather than freezing on the
    // state the page happened to load with.
    const sync = () => setWallet(loadSession()?.wallet ?? null);
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    const t = setInterval(sync, 3_000);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (dismissed) return;
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [dismissed, load]);

  if (dismissed || !progress) return null;
  const { steps, completed, signedIn } = progress;
  const current = steps.find(s => !s.done) ?? steps[steps.length - 1];

  return (
    <section className="demo-guide" aria-label="Guided demo">
      <header className="demo-guide-head">
        <span className="chip chip-info"><FlaskConical size={12} /> FOUR MINUTES</span>
        <div>
          <strong>See the chain refuse a transfer</strong>
          <small>
            {completed === steps.length
              ? "You have seen the whole path. Every step above is backed by a real transaction."
              : "Four steps. Each one ticks itself only when the records say it happened."}
          </small>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
          setDismissed(true);
          try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* fine either way */ }
        }} aria-label="Hide the guided demo">
          <X size={14} />
        </button>
      </header>

      {!signedIn && (
        <p className="help">
          No wallet to hand? <strong>Policy Lab</strong> below runs the same seven gates as a simulation — no wallet, no
          transaction, nothing written down. The steps here need a Devnet wallet because they put real records on Solana.
        </p>
      )}

      <ol className="demo-guide-steps">
        {steps.map((step, i) => (
          <li key={step.key} className={`${step.done ? "is-done" : ""}${step === current && !step.done ? " is-current" : ""}`}>
            <span className="demo-guide-mark" aria-hidden="true">
              {step.done ? <Check size={13} /> : <Circle size={9} />}
            </span>
            <span className="demo-guide-body">
              <strong>{i + 1}. {step.title}</strong>
              <small>{step.detail}</small>
              {step === current && !step.done && <em>{step.look}</em>}
            </span>
            {navigate && !step.done && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(step.slug)}>
                Go <ArrowRight size={12} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
