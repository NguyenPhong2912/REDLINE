import { useCallback, useEffect, useRef, useState } from "react";
import { CornerDownLeft, TerminalSquare } from "lucide-react";
import { api, fmtUsdc, short } from "../lib/api";
import { mono, sans, term } from "../theme";

// One console instead of three widgets.
//
// This product is operated by people who read logs, so the natural place to
// ask it something is a prompt. `ask` is the assistant; every other command
// reads the same endpoints the dashboard does. Nothing here invents a figure:
// if the API cannot answer, the line says so rather than printing a plausible
// number, which is the rule the rest of the product follows.

type Line = { id: number; kind: "in" | "out" | "dim" | "warn" | "good"; text: string };

const HELP = [
  "gates            the seven checks, and how often each has refused a transfer",
  "grants           policy accounts, what they have spent, when they lapse",
  "audit [n]        the last n recorded events (default 8)",
  "explain <CODE>   which gate owns a reason code, and what it means",
  "ask <question>   put a question to the assistant, answered from recorded data",
  "clear            empty the console",
];

let seq = 0;
const line = (kind: Line["kind"], text: string): Line => ({ id: (seq += 1), kind, text });

export function ProtocolConsole({ owner }: { owner?: string }) {
  const [lines, setLines] = useState<Line[]>([
    line("dim", "REDLINE console — every answer below is read from recorded state."),
    line("dim", "Type `help` for what this can tell you."),
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyAt, setHistoryAt] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = useCallback((...next: Line[]) => setLines(prev => [...prev, ...next]), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function runCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    push(line("in", cmd));
    setHistory(prev => [cmd, ...prev].slice(0, 40));
    setHistoryAt(-1);

    const [verb, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    setBusy(true);
    try {
      switch (verb.toLowerCase()) {
        case "help":
          push(...HELP.map(h => line("out", h)));
          break;

        case "clear":
          setLines([]);
          break;

        case "gates": {
          const o = await api.protocolOverview(owner);
          push(line("dim", `${o.scope === "wallet" ? "this wallet" : "protocol-wide"} · ${o.network.cluster}`));
          for (const g of o.gates) {
            const l = g.rejected
              ? line("warn", `${g.id}. ${g.label.padEnd(20)} refused ${g.rejected}× — ${g.detail}`)
              : line("out", `${g.id}. ${g.label.padEnd(20)} clean      — ${g.detail}`);
            push(l);
          }
          push(line("dim", `allowed ${o.activity.allowed} · refused ${o.activity.rejected}`));
          break;
        }

        case "grants": {
          const gs = await api.grants();
          if (!gs.length) { push(line("dim", "no grants recorded")); break; }
          for (const g of gs) {
            const cap = Number(g.policyVersion.spendCapUnits);
            const spent = Number(g.spentUnits);
            const ms = new Date(g.policyVersion.expiresAt).getTime() - Date.now();
            const state = g.revoked ? "REVOKED" : ms <= 0 ? "EXPIRED" : "ACTIVE";
            push(line(state === "ACTIVE" ? "good" : "warn",
              `${short(g.grantPda, 5)}  ${state.padEnd(8)} ${fmtUsdc(String(spent))}/${fmtUsdc(String(cap))} USDC  tx ${g.transactionCount}/${g.policyVersion.maxTransactions}  ${g.agentVersion.name}`));
          }
          break;
        }

        case "audit": {
          const n = Math.min(Math.max(Number(arg) || 8, 1), 40);
          const rows = await api.audit();
          for (const r of rows.slice(-n)) {
            const at = new Date(r.createdAt).toLocaleTimeString("en-US", { hour12: false });
            const fromChain = r.eventType.startsWith("chain.");
            push(line(fromChain ? "good" : "out", `${at}  ${fromChain ? "chain" : "server"}  ${r.eventType}`));
          }
          break;
        }

        case "explain": {
          const code = arg.toUpperCase();
          if (!code) { push(line("warn", "explain what? try `explain SPEND_CAP_EXCEEDED`")); break; }
          const o = await api.protocolOverview(owner);
          const gate = o.gates.find(g => g.reasonCodes.includes(code));
          if (!gate) { push(line("warn", `${code} is not a gate refusal — it may be a chain error, which sits outside the policy`)); break; }
          push(
            line("out", `${code} is gate ${gate.id}, ${gate.label}.`),
            line("out", gate.detail + "."),
            line("dim", `Gates run in order and the first failure stops the transfer, so a ${code} means gates 1–${gate.id - 1} passed and nothing moved.`),
          );
          break;
        }

        case "ask": {
          if (!arg) { push(line("warn", "ask what? try `ask why is my agent being blocked`")); break; }
          const reply = await api.ask(arg, owner);
          push(line("out", reply.answer));
          for (const s of reply.suggestions) {
            push(line("warn", `→ ${s.title}`), line("out", `  ${s.detail}`));
          }
          push(line("dim", reply.source === "model"
            ? `answered by ${reply.model}, grounded in recorded state`
            : "answered from recorded figures — no model configured"));
          break;
        }

        default:
          push(line("warn", `unknown command: ${verb} — try \`help\``));
      }
    } catch (e) {
      push(line("warn", e instanceof Error ? e.message : "the API did not answer"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="redline-console" aria-label="Protocol console">
      <header className="redline-console-bar">
        <TerminalSquare size={12} />
        <span>console</span>
        <span className="redline-console-hint">{owner ? short(owner, 4) : "protocol-wide"}</span>
      </header>

      <div className="redline-console-body" ref={scrollRef}>
        {lines.map(l => (
          <p key={l.id} className={`redline-console-line redline-console-${l.kind}`} style={mono}>
            {l.kind === "in" ? <span className="redline-console-caret">›</span> : null}
            {l.text}
          </p>
        ))}
        {busy && <p className="redline-console-line redline-console-dim" style={mono}>…</p>}
      </div>

      <form
        className="redline-console-input"
        onSubmit={e => { e.preventDefault(); const v = input; setInput(""); void runCommand(v); }}
      >
        <span className="redline-console-caret">›</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            // A console people type into should remember what they typed.
            if (e.key === "ArrowUp" && history.length) {
              e.preventDefault();
              const next = Math.min(historyAt + 1, history.length - 1);
              setHistoryAt(next); setInput(history[next]);
            } else if (e.key === "ArrowDown" && historyAt >= 0) {
              e.preventDefault();
              const next = historyAt - 1;
              setHistoryAt(next); setInput(next < 0 ? "" : history[next]);
            }
          }}
          placeholder="ask why is my agent being blocked"
          aria-label="Console command"
          spellCheck={false}
          autoComplete="off"
          style={{ ...mono }}
        />
        <button type="submit" disabled={busy} aria-label="Run command"><CornerDownLeft size={12} /></button>
      </form>

      <p className="redline-console-note" style={sans}>
        Answers come from this deployment's own records. Where a figure is unknown the console says so instead of estimating one.
      </p>
    </section>
  );
}

export const consoleTone = term;
