import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Fingerprint, Play, Sparkles } from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { motion, useReducedMotion } from "motion/react";
import { DashboardLiveGrants } from "./DashboardLiveGrants";
import { LiveFeed } from "./LiveFeed";
import { ProtocolSpine } from "./ProtocolSpine";
import { api, type Analytics } from "../lib/api";
import type { AppClient } from "../solana/client";
import { color, mono, sans } from "../theme";
import heroArt from "../../assets/redline-celestial-vault-hero.webp";

const principles = [
  { number: "01", title: "Propose", body: "An autonomous agent can request an action, but it never receives unrestricted authority." },
  { number: "02", title: "Constrain", body: "The owner's signed policy becomes a hard envelope around asset, recipient, budget, pace and time." },
  { number: "03", title: "Prove", body: "Every allow or rejection leaves evidence that can be inspected independently on Solana." },
];

export function ProtocolExperience({ setNav }: { setNav?: (index: number) => void }) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const [stats, setStats] = useState<Analytics | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!owner) {
      setStats(null);
      return;
    }
    let active = true;
    const load = () => api.analytics(owner).then(value => {
      if (active) setStats(value);
    }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [owner]);

  const facts = [
    ["Active policies", stats ? String(stats.activeGrants) : "—"],
    ["Settled volume", stats ? `${stats.totalVolumeUsdc.toLocaleString()} USDC` : "—"],
    ["Policy blocks", stats ? String(stats.totalRejections) : "—"],
    ["Decision latency", stats?.avgDecisionLatencyMs != null ? `${stats.avgDecisionLatencyMs} ms` : "—"],
  ];

  const chaptersRef = useRef<HTMLElement | null>(null);
  const scrollToChapters = () =>
    chaptersRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  return (
    <article className="protocol-experience">
      <section className="protocol-hero">
        <motion.img
          src={heroArt}
          alt=""
          aria-hidden="true"
          width={1672}
          height={941}
          decoding="async"
          fetchPriority="high"
          className="protocol-hero-art"
          initial={reduced ? false : { scale: 1.025, opacity: 0.65 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="protocol-hero-wash" aria-hidden="true" />
        <motion.div
          className="protocol-hero-copy"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="protocol-kicker">
            <Sparkles size={12} /> Protection for autonomous finance
          </div>
          <h1 className="protocol-hero-title">
            Boundless intelligence.
            <span>Protected by design.</span>
          </h1>
          <p className="protocol-hero-lede">
            Give AI agents room to act while REDLINE keeps every asset, recipient, budget and decision inside your signed boundaries.
          </p>
          <div className="protocol-hero-actions">
            <button type="button" onClick={() => setNav?.(6)} className="protocol-primary-action">
              Enter REDLINE <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={() => setNav?.(5)} className="protocol-text-action">
              <Play size={13} fill="currentColor" /> Explore the protocol
            </button>
          </div>
        </motion.div>
        {/* It looks like an affordance and reads like an instruction, so it has
            to behave like one. It was a decorative div that did nothing when
            clicked. */}
        <button type="button" className="protocol-scroll-cue" onClick={scrollToChapters}>
          Discover the boundary <ArrowDown size={14} />
        </button>
      </section>

      <div className="protocol-facts" aria-label="Protocol facts">
        {facts.map(([label, value]) => (
          <div key={label} className="protocol-fact">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        {!owner && <div className="protocol-facts-note">Connect a wallet to scope these figures to your policies.</div>}
      </div>

      <section className="protocol-chapter" ref={chaptersRef}>
        <div className="protocol-chapter-heading">
          <span>Chapter 01 / Enforcement</span>
          <h2>A transaction is a journey with seven possible exits.</h2>
        </div>
        <ProtocolSpine owner={owner || undefined} />
      </section>

      <section className="protocol-principles" aria-label="How REDLINE works">
        {principles.map((principle, index) => (
          <motion.div
            key={principle.number}
            className="protocol-principle"
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ delay: reduced ? 0 : index * 0.08 }}
          >
            <span>{principle.number}</span>
            <h3>{principle.title}</h3>
            <p>{principle.body}</p>
          </motion.div>
        ))}
      </section>

      <section className="protocol-chapter protocol-proof-chapter">
        <div className="protocol-chapter-heading">
          <span>Chapter 02 / Evidence</span>
          <h2>What the chain decided, while it is happening.</h2>
        </div>
        <div className="protocol-proof-layout">
          <div className="protocol-proof-copy">
            <Fingerprint size={24} />
            <p>Runtime logs are not the source of truth. REDLINE re-reads program events and attaches transaction signatures so every claim can be followed back to the chain.</p>
            <button type="button" onClick={() => setNav?.(5)}>
              Open the full audit trail <ArrowUpRight size={13} />
            </button>
          </div>
          <LiveFeed />
        </div>
      </section>

      <section className="protocol-chapter protocol-live-chapter">
        <div className="protocol-chapter-heading">
          <span>Chapter 03 / Ownership</span>
          <h2>Signed boundaries currently in force.</h2>
        </div>
        <DashboardLiveGrants onNavigate={() => setNav?.(6)} />
      </section>

      <footer className="protocol-footer">
        <span style={mono}>REDLINE / SOLANA DEVNET</span>
        <p style={sans}>The agent proposes. The chain decides.</p>
      </footer>
    </article>
  );
}
