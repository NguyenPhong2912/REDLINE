import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Fingerprint, Play, Sparkles } from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DashboardLiveGrants } from "./DashboardLiveGrants";
import { LiveFeed } from "./LiveFeed";
import { ProtocolConsole } from "./ProtocolConsole";
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
  const [showProtocolReturn, setShowProtocolReturn] = useState(false);
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLElement | null>(null);

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
  const evidenceRef = useRef<HTMLElement | null>(null);
  const ownershipRef = useRef<HTMLElement | null>(null);
  const consoleRef = useRef<HTMLElement | null>(null);
  const scrollToChapters = () =>
    chaptersRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  const scrollToChapter = (target: React.RefObject<HTMLElement | null>) =>
    target.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  const scrollToProtocol = () =>
    heroRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowProtocolReturn(!entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="protocol-experience">
      <section className="protocol-hero" ref={heroRef}>
        <motion.div
          className="protocol-hero-art-layer"
          aria-hidden="true"
          initial={reduced ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={heroArt} alt="" width={1672} height={941} decoding="async" fetchPriority="high" />
        </motion.div>
        <div className="protocol-hero-wash" aria-hidden="true" />
        <div className="protocol-depth-field" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
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
            <span className="protocol-title-line">Boundless intelligence.</span>
            <span className="protocol-title-line protocol-title-accent">Protected by design.</span>
          </h1>
          <p className="protocol-hero-lede">
            Give AI agents room to act while REDLINE keeps every asset, recipient, budget and decision inside your signed boundaries.
          </p>
          <div className="protocol-hero-actions">
            <button type="button" onClick={() => setNav?.(6)} className="protocol-primary-action">
              Enter REDLINE <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={scrollToChapters} className="protocol-text-action">
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

      <AnimatePresence>
        {showProtocolReturn && (
          <motion.button
            type="button"
            className="protocol-return-button"
            onClick={scrollToProtocol}
            aria-label="Back to the top of Protocol"
            initial={reduced ? false : { opacity: 0, y: 10, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 8, scale: .96 }}
            transition={{ duration: reduced ? 0 : .22 }}
          >
            <ArrowUp size={15} />
            <span>Back to Protocol</span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="protocol-story">
        <nav className={`protocol-chapter-nav ${showProtocolReturn ? "is-visible" : ""}`} aria-label="Protocol chapters">
          {[
            ["01", "Enforcement", chaptersRef],
            ["02", "Evidence", evidenceRef],
            ["03", "Ownership", ownershipRef],
            ["04", "Interrogate", consoleRef],
          ].map(([number, label, target]) => (
            <button type="button" key={String(number)} onClick={() => scrollToChapter(target as React.RefObject<HTMLElement | null>)}>
              <span>{String(number)}</span>{String(label)}
            </button>
          ))}
        </nav>

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
        <button type="button" className="protocol-next-chapter" onClick={() => scrollToChapter(evidenceRef)}>
          <span>Continue the protocol</span>
          Chapter 02 / Evidence <ArrowDown size={14} />
        </button>
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

      <section className="protocol-chapter protocol-proof-chapter" ref={evidenceRef}>
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
        <button type="button" className="protocol-next-chapter" onClick={() => scrollToChapter(ownershipRef)}>
          <span>Continue the protocol</span>
          Chapter 03 / Ownership <ArrowDown size={14} />
        </button>
      </section>

      <section className="protocol-chapter protocol-live-chapter" ref={ownershipRef}>
        <div className="protocol-chapter-heading">
          <span>Chapter 03 / Ownership</span>
          <h2>Signed boundaries currently in force.</h2>
        </div>
        <DashboardLiveGrants onNavigate={() => setNav?.(6)} />
        <button type="button" className="protocol-next-chapter" onClick={() => scrollToChapter(consoleRef)}>
          <span>Continue the protocol</span>
          Chapter 04 / Interrogate <ArrowDown size={14} />
        </button>
      </section>

      {/* Last, because it answers the question the chapters above raise: fine,
          then ask it yourself. */}
      <section className="protocol-chapter protocol-console-chapter" ref={consoleRef}>
        <div className="protocol-chapter-heading">
          <span>Chapter 04 / Interrogate</span>
          <h2>Ask it what it did, and why.</h2>
        </div>
        <div className="protocol-console-layout">
          <div className="protocol-console-copy">
            <p>
              Every figure this protocol holds is queryable. Type <code>gates</code> to see which
              check has been stopping work, <code>explain SPEND_CAP_EXCEEDED</code> to read what a
              refusal meant, or <code>ask</code> anything in plain language.
            </p>
            <p>
              The assistant is handed the same recorded state you can read yourself, and nothing
              else. When it does not know, it says so rather than estimating.
            </p>
          </div>
          <ProtocolConsole owner={owner || undefined} />
        </div>
      </section>

      <footer className="protocol-footer">
        <span style={mono}>REDLINE / SOLANA DEVNET</span>
        <p style={sans}>The agent proposes. The chain decides.</p>
      </footer>
      </div>
    </article>
  );
}
