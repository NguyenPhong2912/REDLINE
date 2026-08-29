import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, Check, Cpu, Database, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { api, short, type ProtocolOverview } from "../lib/api";
import { color, mono, panel, sans } from "../theme";

const FALLBACK_GATES: ProtocolOverview["gates"] = [
  [1, "Active grant", "Owner has not revoked access"],
  [2, "Time window", "Grant has not expired"],
  [3, "Fresh intent", "Nonce cannot be replayed"],
  [4, "Allowed asset", "Mint is inside the signed scope"],
  [5, "Allowed recipient", "Destination is allowlisted"],
  [6, "Budget envelope", "Spend and transaction caps hold"],
  [7, "Execution pace", "Cooldown has elapsed"],
].map(([id, label, detail]) => ({ id: Number(id), key: String(id), label: String(label), detail: String(detail), reasonCodes: [], rejected: 0 }));

export function ProtocolSpine({ owner }: { owner?: string }) {
  const [data, setData] = useState<ProtocolOverview | null>(null);
  const [offline, setOffline] = useState(false);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    try {
      setData(await api.protocolOverview(owner));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [owner]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const gates = data?.gates ?? FALLBACK_GATES;
  // Until the API answers these are unknown, not zero. A zero here would claim
  // the protocol has allowed and blocked nothing — on the page whose whole job
  // is to show that it has, and on a host that sleeps, so an unanswered first
  // load is routine rather than rare. Everything else in this product drops a
  // number it cannot source; so does this.
  const allowed = data ? String(data.activity.allowed) : "—";
  const rejected = data ? String(data.activity.rejected) : "—";

  return (
    <section className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 redline-spine" style={panel()} aria-label="Seven-gate transaction pipeline">
      <div className="absolute inset-0 redline-spine-grid" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ ...mono, color: color.primary }}>
              <Activity size={12} /> Live policy backbone
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ ...sans, color: color.text }}>Every transaction crosses seven hard limits.</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5" style={{ ...sans, color: color.textMuted }}>
              The agent proposes. The program evaluates the signed envelope in order. One failed gate stops the transfer atomically.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full px-3 py-1.5" style={{ background: color.surfaceSubtle, border: `1px solid ${color.border}` }}>
            <span className={`h-1.5 w-1.5 rounded-full ${offline ? "" : "redline-live-dot"}`} style={{ background: offline ? color.warn : color.primary }} />
            <span className="text-[10px] uppercase tracking-[0.16em]" style={{ ...mono, color: offline ? color.warn : color.textSecondary }}>
              {offline ? "Preview mode" : `${data?.network.cluster ?? "connecting"} · ${data ? short(data.network.programId, 5) : "syncing"}`}
            </span>
          </div>
        </div>

        <div className="redline-spine-stage">
          <motion.div className="redline-endpoint" initial={false} animate={reduced ? undefined : { y: [0, -3, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <Cpu size={17} />
            <span>AGENT</span>
          </motion.div>

          <div className="redline-gates" role="list" aria-label="Policy gates">
            {gates.map((gate, index) => (
              <motion.div
                key={gate.id}
                role="listitem"
                className="redline-gate group"
                title={`${gate.label}: ${gate.detail}`}
                initial={reduced ? false : { opacity: 0, z: -30, y: 8 }}
                animate={{ opacity: 1, z: 0, y: 0 }}
                transition={{ delay: reduced ? 0 : index * 0.055, duration: 0.4 }}
                style={{ borderColor: gate.rejected ? `${color.danger}66` : color.border }}
              >
                <span className="redline-gate-index">0{gate.id}</span>
                <span className="redline-gate-check" style={{ color: gate.rejected ? color.danger : color.primary }}>
                  {gate.rejected ? gate.rejected : <Check size={11} />}
                </span>
                <span className="redline-gate-label">{gate.label}</span>
              </motion.div>
            ))}
            {!reduced && <motion.span className="redline-transaction-pulse" animate={{ left: ["0%", "96%"], opacity: [0, 1, 1, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }} />}
          </div>

          <ArrowRight className="hidden xl:block" size={16} style={{ color: color.textDim }} />
          <motion.div className="redline-endpoint redline-vault" initial={false} animate={reduced ? undefined : { boxShadow: ["0 0 0 rgba(45,212,191,0)", "0 0 28px rgba(45,212,191,.18)", "0 0 0 rgba(45,212,191,0)"] }} transition={{ duration: 3.2, repeat: Infinity }}>
            <Database size={17} />
            <span>VAULT</span>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { label: "Scope", value: data?.scope === "wallet" ? "Connected wallet" : "Protocol", icon: ShieldCheck },
            { label: "Active grants", value: String(data?.activity.activeGrants ?? "—"), icon: Activity },
            { label: "Allowed", value: allowed, icon: Check },
            { label: "Blocked", value: rejected, icon: ShieldCheck },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: color.surfaceSubtle, border: `1px solid ${color.border}` }}>
                <Icon size={13} style={{ color: color.primary }} />
                <div>
                  <div className="text-[9px] uppercase tracking-[0.12em]" style={{ ...sans, color: color.textDim }}>{item.label}</div>
                  <div className="mt-0.5 text-[11px] font-semibold" style={{ ...mono, color: color.text }}>{item.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
